import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import Order from '@/lib/models/Order';
import SessionCredit from '@/lib/models/SessionCredit';
import Invoice from '@/lib/models/Invoice';
import User from '@/lib/models/User';
import { expiryFor } from '@/lib/pricing';
import { nextChargeDate } from '@/lib/invoicing';
import { getStripe } from '@/lib/stripe';
import { sendCreditPurchaseFailed, sendInvoicePaymentFailed, sendOrderConfirmation } from '@/lib/mailer';
import { createPrintfulOrder } from '@/lib/printful';
import { createLuluJob } from '@/lib/luluClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/payments/webhook: Stripe webhook. Uses the raw request body so the
// signature verifies (Next does not parse the body for us here).
export async function POST(request) {
  const stripe = getStripe();
  const sig = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const pi = event.data?.object;
  const source = pi?.metadata?.source;

  try {
    if (event.type === 'payment_intent.succeeded') {
      await dbConnect();
      if (source === 'shop') {
        await handleShopPayment(pi, stripe);
      } else if (source === 'credits') {
        await handleCreditPurchase(pi);
      } else if (source === 'invoice') {
        await settleInvoice(pi, stripe);
      } else {
        await Enrollment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { paymentStatus: 'paid', paidAt: new Date() },
        );
        console.log(`Enrollment payment confirmed for intent ${pi.id}`);
      }
    } else if (event.type === 'payment_intent.processing') {
      // Bank debits do not settle immediately. The family has authorized it and
      // should not be chased, but the money is not here yet — so the invoice
      // moves to its own state rather than straight to paid.
      if (source === 'invoice') {
        await dbConnect();
        await Invoice.findOneAndUpdate(
          { stripePaymentIntentId: pi.id, status: { $in: ['open', 'processing'] } },
          { status: 'processing', lastPaymentError: '' },
        );
        console.log(`Invoice ${pi.metadata.invoiceNumber} bank transfer processing (${pi.id})`);
      } else if (source === 'credits') {
        // A clearing bank transfer gets a visible pending row with ZERO
        // remaining sessions — the family sees their purchase is on its way,
        // and nothing can book against money that has not arrived. Activated on
        // .succeeded, deleted on .payment_failed. The unique index on
        // stripePaymentIntentId makes a redelivery a no-op.
        await dbConnect();
        try {
          await SessionCredit.create({
            userId: pi.metadata.userId,
            tutorId: pi.metadata.tutorId || null,
            sessionType: pi.metadata.sessionType === 'private' ? 'private' : 'semi_private',
            pending: true,
            totalSessions: Number(pi.metadata.sessions || 0),
            remainingSessions: 0,
            note: `${pi.metadata.packName || 'Session pack'} — bank transfer clearing`,
            grantedBy: 'stripe',
            stripePaymentIntentId: pi.id,
            packId: pi.metadata.packId || '',
            amountPaidCents: pi.amount,
            onlineFeeCents: Number(pi.metadata.onlineFeeCents || 0),
            expiresAt: null, // the window starts when the money lands
          });
          console.log(`Credit purchase pending (bank transfer) for intent ${pi.id}`);
        } catch (err) {
          if (err && err.code === 11000) {
            console.log(`Pending credit row for intent ${pi.id} already exists; skipping.`);
          } else {
            throw err;
          }
        }
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      // A bank debit can fail days later (insufficient funds, closed account),
      // which is exactly why nothing is marked paid before this point.
      if (source === 'credits') {
        // Nothing active exists to unwind — sessions are only granted on
        // success. Remove the pending row (it held zero bookable sessions) and
        // tell the family, because they left believing they had bought
        // sessions and a silent vanish is indistinguishable from theft.
        await dbConnect();
        await SessionCredit.deleteOne({ stripePaymentIntentId: pi.id, pending: true });
        const user = await User.findById(pi.metadata.userId).select('email firstName name').catch(() => null);
        if (user?.email) {
          try {
            await sendCreditPurchaseFailed({
              to: user.email,
              parentName: user.firstName || user.name || 'there',
              packName: pi.metadata.packName || 'your session package',
              amountCents: pi.amount,
              reason: pi.last_payment_error?.message || '',
              siteUrl: process.env.SITE_URL || 'https://www.dotorischool.org',
            });
          } catch (mailErr) {
            console.error('Credit-purchase failure email failed:', mailErr?.message || mailErr);
          }
        }
        console.log(`Credit purchase failed for intent ${pi.id}`);
      } else if (source === 'invoice') {
        await dbConnect();
        const message =
          pi.last_payment_error?.message || 'The payment did not go through. Please try again.';
        const inv = await Invoice.findById(pi.metadata.invoiceId);
        if (inv && inv.status !== 'paid') {
          inv.lastPaymentError = message;
          if (inv.plan?.status === 'active' && (inv.plan.chargedCount || 0) > 0) {
            // A plan that has already taken money must not fall back to "open" —
            // that would invite the family to pay the whole thing again.
            inv.plan.lastError = message;
            inv.plan.failedAttempts = (inv.plan.failedAttempts || 0) + 1;
            if (inv.plan.failedAttempts >= 3) inv.plan.status = 'failed';
          } else {
            inv.status = 'open';
          }
          await inv.save();

          // A card decline happens with the family at the keyboard; a bank
          // transfer bounces days later with nobody watching. Only the latter
          // needs chasing by email.
          if (pi.metadata.method === 'ach' && !(inv.plan?.chargedCount > 0)) {
            const user = await User.findById(inv.userId).select('email firstName name').catch(() => null);
            if (user?.email) {
              try {
                await sendInvoicePaymentFailed({
                  to: user.email,
                  parentName: user.firstName || user.name || 'there',
                  invoiceNumber: inv.number,
                  amountCents: pi.amount,
                  reason: message,
                  siteUrl: process.env.SITE_URL || 'https://www.dotorischool.org',
                });
              } catch (mailErr) {
                console.error('Invoice bounce email failed:', mailErr?.message || mailErr);
              }
            }
          }
        }
        console.log(`Invoice payment failed for intent ${pi.id}: ${message}`);
      }
    }
  } catch (err) {
    console.error('Payment processing error:', err);
  }

  return Response.json({ received: true });
}

// A charge against an invoice landed. Handles both a single payment and one
// installment of a monthly plan.
//
// Idempotency is the $ne guard on the payments array: a redelivered event finds
// its own intent id already recorded and matches nothing, so it cannot be
// counted twice.
async function settleInvoice(pi, stripe) {
  const amountCents = pi.amount_received ?? pi.amount;
  const feeCents = Number(pi.metadata.feeCents || 0);
  const installments = Number(pi.metadata.installments || 0) || null;
  const installmentNumber = Number(pi.metadata.installmentNumber || 0) || null;

  const invoice = await Invoice.findOneAndUpdate(
    { _id: pi.metadata.invoiceId, 'payments.stripePaymentIntentId': { $ne: pi.id } },
    {
      $push: {
        payments: {
          at: new Date(),
          amountCents,
          feeCents,
          stripePaymentIntentId: pi.id,
          installmentNumber,
        },
      },
      $inc: { totalPaidCents: amountCents },
      $set: { lastPaymentError: '' },
    },
    { new: true },
  );
  if (!invoice) {
    console.log(`Payment ${pi.id} already recorded; skipping.`);
    return;
  }

  const planned = invoice.plan?.installments || installments;

  if (!planned) {
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    await invoice.save();
  } else {
    const chargedCount = invoice.payments.length;
    invoice.plan.installments = planned;
    invoice.plan.chargedCount = chargedCount;
    invoice.plan.lastError = '';
    invoice.plan.failedAttempts = 0;

    // Keep the card for the remaining installments. Only worth doing on the first
    // charge — later ones already used the stored method.
    if (pi.payment_method && !invoice.plan.stripePaymentMethodId) {
      invoice.plan.stripePaymentMethodId =
        typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method.id;
      if (pi.customer) invoice.plan.stripeCustomerId = pi.customer;
      try {
        const pm = await stripe.paymentMethods.retrieve(invoice.plan.stripePaymentMethodId);
        invoice.plan.cardBrand = pm.card?.brand || '';
        invoice.plan.cardLast4 = pm.card?.last4 || '';
      } catch {
        /* cosmetic only — the plan still charges without the brand */
      }
    }

    if (chargedCount >= planned) {
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.plan.status = 'complete';
      invoice.plan.nextChargeAt = null;
    } else {
      // Partly paid is its own state: the family owes nothing today but the
      // invoice is not settled, so it must not read as either.
      invoice.status = 'processing';
      invoice.plan.status = 'active';
      invoice.plan.nextChargeAt = nextChargeDate(invoice, chargedCount);
    }
    await invoice.save();
  }

  if (invoice.enrollmentId) {
    // The seat is settled only when the invoice is, which for a plan means every
    // installment has landed. amountPaid tracks tuition actually received.
    const tuitionPaidCents =
      invoice.status === 'paid'
        ? invoice.subtotalCents
        : Math.max(0, (invoice.totalPaidCents || 0) - (invoice.payments || []).reduce((sum, p) => sum + (p.feeCents || 0), 0));

    await Enrollment.findByIdAndUpdate(invoice.enrollmentId, {
      amountPaid: tuitionPaidCents / 100,
      ...(invoice.status === 'paid' ? { paymentStatus: 'paid', paidAt: new Date() } : {}),
    });
  }

  console.log(
    `Invoice ${invoice.number}: ${invoice.payments.length}/${planned || 1} charged, status ${invoice.status}`,
  );
}

// A family bought a session-credit pack in the portal. The grant is created here
// rather than at checkout so an abandoned payment never hands out credits.
// The unique sparse index on stripePaymentIntentId makes a webhook redelivery a
// no-op instead of a double grant.
async function handleCreditPurchase(pi) {
  const sessions = Number(pi.metadata.sessions || 0);
  if (!sessions) {
    console.error('Credit purchase with no session count:', pi.id);
    return;
  }
  // Read back from the intent rather than looking the pack up again: rates are
  // per tutor and can be edited, and what the family agreed to is what was on
  // the intent at the time.
  const feeCents = Number(pi.metadata.onlineFeeCents || 0);
  const packName = pi.metadata.packName || `${sessions} sessions`;

  try {
    await SessionCredit.create({
      userId: pi.metadata.userId,
      // Scoped to the tutor whose rates were charged. lib/booking.js spends this
      // on that tutor first, and it is not usable with anyone else.
      tutorId: pi.metadata.tutorId || null,
      // Which kind of session these credits may book. Read back from the intent
      // rather than looked up again, because rates can change afterwards.
      sessionType: pi.metadata.sessionType === 'private' ? 'private' : 'semi_private',
      totalSessions: sessions,
      remainingSessions: sessions,
      note: `${packName} purchased online`,
      grantedBy: 'stripe',
      stripePaymentIntentId: pi.id,
      packId: pi.metadata.packId || '',
      amountPaidCents: pi.amount_received ?? pi.amount,
      onlineFeeCents: feeCents,
      // Counted from when the money landed, not from when the family started
      // checking out.
      expiresAt: expiryFor(Number(pi.metadata.validMonths) || null),
    });
    console.log(`Granted ${sessions} credits for intent ${pi.id}`);
  } catch (err) {
    // 11000 = duplicate key: either a redelivered event (no-op) or the pending
    // row a clearing bank transfer created — which is now activated. Filtering
    // on pending:true keeps the redelivery a no-op even here: an already-active
    // grant matches nothing, so a family's spent sessions can never be topped
    // back up by Stripe retrying the event.
    if (err && err.code === 11000) {
      const activated = await SessionCredit.findOneAndUpdate(
        { stripePaymentIntentId: pi.id, pending: true },
        {
          $set: {
            pending: false,
            totalSessions: sessions,
            remainingSessions: sessions,
            note: `${packName} purchased online`,
            amountPaidCents: pi.amount_received ?? pi.amount,
            expiresAt: expiryFor(Number(pi.metadata.validMonths) || null),
          },
        },
      );
      console.log(
        activated
          ? `Activated pending credit grant for intent ${pi.id}`
          : `Credit grant for intent ${pi.id} already exists; skipping.`,
      );
      return;
    }
    throw err;
  }
}

async function handleShopPayment(pi, stripe) {
  const order = await Order.findOneAndUpdate(
    { stripePaymentIntentId: pi.id },
    { paymentStatus: 'paid', paidAt: new Date() },
    { new: true },
  );
  if (!order) {
    console.error('Shop order not found for intent:', pi.id);
    return;
  }
  console.log(`Shop order ${order._id} payment confirmed.`);

  // Order confirmation email
  try {
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    await sendOrderConfirmation({ to: order.email, firstName: order.firstName, order, siteUrl });
  } catch (mailErr) {
    console.error('Order confirmation email failed:', mailErr.message);
  }

  // Record Stripe Tax transaction for audit trail
  if (order.stripeTaxCalculationId) {
    try {
      await stripe.tax.transactions.createFromCalculation({
        calculation: order.stripeTaxCalculationId,
        reference: order._id.toString(),
      });
    } catch (taxErr) {
      console.error('Stripe Tax transaction creation failed:', taxErr.message);
    }
  }

  // Fulfill Printful items (idempotent)
  const hasPrintful = order.items.some((i) => i.fulfiller === 'printful');
  if (hasPrintful && !order.printfulOrderId) {
    await createPrintfulOrder(order);
  }

  // Fulfill Lulu items
  const hasLulu = order.items.some((i) => i.fulfiller === 'lulu');
  if (hasLulu && !order.luluJobId) {
    try {
      await createLuluJob(order);
    } catch (luluErr) {
      console.error('Lulu job creation error:', luluErr.message);
      await Order.findByIdAndUpdate(order._id, { fulfillmentStatus: 'error' });
    }
  }

  // Update fulfillment status
  if (hasPrintful || hasLulu) {
    const updated = await Order.findById(order._id);
    if (updated && updated.fulfillmentStatus === 'unfulfilled') {
      await Order.findByIdAndUpdate(order._id, { fulfillmentStatus: 'partial' });
    }
  }
}
