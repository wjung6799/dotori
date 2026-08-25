import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import Order from '@/lib/models/Order';
import SessionCredit from '@/lib/models/SessionCredit';
import Invoice from '@/lib/models/Invoice';
import { findPack } from '@/lib/pricing';
import { getStripe } from '@/lib/stripe';
import { sendOrderConfirmation } from '@/lib/mailer';
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
        await settleInvoice(pi);
      } else {
        await Enrollment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { paymentStatus: 'paid', paidAt: new Date() },
        );
        console.log(`Enrollment payment confirmed for intent ${pi.id}`);
      }
    } else if (event.type === 'payment_intent.processing') {
      // Bank debits do not settle immediately. The family has authorised it and
      // should not be chased, but the money is not here yet — so the invoice
      // moves to its own state rather than straight to paid.
      if (source === 'invoice') {
        await dbConnect();
        await Invoice.findOneAndUpdate(
          { stripePaymentIntentId: pi.id, status: { $in: ['open', 'processing'] } },
          { status: 'processing', lastPaymentError: '' },
        );
        console.log(`Invoice ${pi.metadata.invoiceNumber} bank transfer processing (${pi.id})`);
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      // A bank debit can fail days later (insufficient funds, closed account),
      // which is exactly why nothing is marked paid before this point.
      if (source === 'invoice') {
        await dbConnect();
        await Invoice.findOneAndUpdate(
          { stripePaymentIntentId: pi.id, status: { $ne: 'paid' } },
          {
            status: 'open',
            lastPaymentError:
              pi.last_payment_error?.message || 'The payment did not go through. Please try again.',
          },
        );
        console.log(`Invoice payment failed for intent ${pi.id}`);
      }
    }
  } catch (err) {
    console.error('Payment processing error:', err);
  }

  return Response.json({ received: true });
}

// A family paid an invoice. The enrollment it belongs to is settled at the same
// time, so the portal and the admin's enrollment list agree.
//
// The status guard makes a webhook redelivery a no-op: the second delivery
// matches nothing, because the first already moved the invoice to 'paid'.
async function settleInvoice(pi) {
  const invoice = await Invoice.findOneAndUpdate(
    { stripePaymentIntentId: pi.id, status: { $ne: 'paid' } },
    {
      status: 'paid',
      paidAt: new Date(),
      totalPaidCents: pi.amount_received ?? pi.amount,
      lastPaymentError: '',
    },
    { new: true },
  );
  if (!invoice) {
    console.log(`Invoice for intent ${pi.id} already settled; skipping.`);
    return;
  }

  if (invoice.enrollmentId) {
    // A seat on a payment plan is not settled by its first instalment. Gather
    // every live invoice in the plan and only mark the enrollment paid once all
    // of them have landed — otherwise one payment of three closes the debt.
    const siblings = invoice.planId
      ? await Invoice.find({ planId: invoice.planId, status: { $ne: 'void' } }).lean()
      : [invoice];

    const allPaid = siblings.length > 0 && siblings.every((s) => s.status === 'paid');
    // Tuition only. The convenience fee is what the card channel cost, not
    // revenue for the class, and folding it in here would inflate every
    // tuition figure the school reports.
    const tuitionPaidCents = siblings
      .filter((s) => s.status === 'paid')
      .reduce((sum, s) => sum + (s.subtotalCents || 0), 0);

    await Enrollment.findByIdAndUpdate(invoice.enrollmentId, {
      amountPaid: tuitionPaidCents / 100,
      ...(allPaid ? { paymentStatus: 'paid', paidAt: new Date() } : {}),
    });
    if (!allPaid) {
      const done = siblings.filter((s) => s.status === 'paid').length;
      console.log(`Enrollment ${invoice.enrollmentId} now ${done}/${siblings.length} paid; still pending.`);
    }
  }
  console.log(`Invoice ${invoice.number} paid via ${invoice.paymentMethod} (${pi.id})`);
}

// A family bought a session-credit pack in the portal. The grant is created here
// rather than at checkout so an abandoned payment never hands out credits.
// The unique sparse index on stripePaymentIntentId makes a webhook redelivery a
// no-op instead of a double grant.
async function handleCreditPurchase(pi) {
  const pack = findPack(pi.metadata.packId);
  if (!pack) {
    console.error('Credit purchase for unknown pack:', pi.metadata.packId, pi.id);
    return;
  }
  try {
    await SessionCredit.create({
      userId: pi.metadata.userId,
      tutorId: null,
      totalSessions: pack.sessions,
      remainingSessions: pack.sessions,
      note: `${pack.name} purchased online`,
      grantedBy: 'stripe',
      stripePaymentIntentId: pi.id,
      packId: pack.id,
      amountPaidCents: pi.amount_received ?? pack.amountCents,
    });
    console.log(`Granted ${pack.sessions} credits for intent ${pi.id}`);
  } catch (err) {
    // 11000 = duplicate key, i.e. this webhook already ran. Anything else is real.
    if (err && err.code === 11000) {
      console.log(`Credit grant for intent ${pi.id} already exists; skipping.`);
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
