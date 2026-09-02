import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Invoice from '@/lib/models/Invoice';
import User from '@/lib/models/User';
import { invoiceTotals, isPayable, STRIPE_MIN_CENTS, installmentSchedule, MAX_INSTALLMENTS } from '@/lib/invoicing';
import { ONLINE_METHODS } from '@/lib/pricing';
import { getStripe } from '@/lib/stripe';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// The online channel offers what ONLINE_METHODS in lib/pricing.js lists — ACH
// and card today. A method in this map but not in that list is refused, so the
// pricing module stays the single switch.
const METHODS = {
  card: { types: ['card'], label: 'card' },
  ach: { types: ['us_bank_account'], label: 'bank transfer' },
};

// POST /api/family/invoices/:id/pay  body { method: 'card', installments?: 2|3 }
// Creates the PaymentIntent for one invoice and hands back its client secret.
// The invoice is NOT settled here — only the webhook may do that, so a family
// that abandons the sheet leaves nothing marked paid.
//
// With `installments`, this charges only the first of them and asks Stripe to
// keep the card on file; the rest are taken off-session by
// /api/cron/charge-installments. One invoice, one authorisation, no chasing.
export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const method = METHODS[body?.method] && ONLINE_METHODS.includes(body.method) ? body.method : null;
  if (!method) {
    return Response.json(
      { error: 'That payment method is not available online. Please contact the school to pay by Zelle or check.' },
      { status: 400 },
    );
  }

  await dbConnect();
  // Scope by userId as well as id: an invoice id must never be payable, or even
  // readable, by another family.
  const invoice = await Invoice.findOne({ _id: id, userId: user._id });
  if (!invoice) return Response.json({ error: 'Invoice not found.' }, { status: 404 });

  if (invoice.status === 'paid') {
    return Response.json({ error: 'This invoice is already paid.' }, { status: 409 });
  }
  if (invoice.status === 'processing') {
    return Response.json(
      { error: 'A bank transfer for this invoice is still clearing. It can take a few business days.' },
      { status: 409 },
    );
  }
  if (invoice.status === 'void') {
    return Response.json({ error: 'This invoice was cancelled.' }, { status: 409 });
  }
  if (!isPayable(invoice)) {
    return Response.json(
      { error: `This invoice is below the ${STRIPE_MIN_CENTS}-cent minimum for online payment. Please contact the school.` },
      { status: 400 },
    );
  }

  // Recomputed server-side from the stored subtotal — never from anything the
  // client sent, so a fee cannot be talked down by the browser.
  const totals = invoiceTotals(invoice, method);

  // A plan can only be chosen while nothing has been charged yet.
  const wanted = Number(body?.installments);
  const installments =
    Number.isFinite(wanted) && wanted >= 2 && wanted <= MAX_INSTALLMENTS ? Math.round(wanted) : null;
  if (installments && invoice.plan?.installments) {
    return Response.json({ error: 'This invoice is already on a payment plan.' }, { status: 409 });
  }

  // A plan keeps the payment method on file and charges it off-session monthly,
  // which this project only does with cards. Bank transfer pays in full.
  if (installments && method !== 'card') {
    return Response.json(
      { error: 'Monthly plans are card-only. Pay in full by bank transfer, or choose card for a plan.' },
      { status: 400 },
    );
  }

  const schedule = installments ? installmentSchedule(invoice, installments) : null;
  const chargeCents = schedule ? schedule[0].amountCents : totals.totalCents;

  if (chargeCents < STRIPE_MIN_CENTS) {
    return Response.json(
      { error: 'Each payment would be below the minimum we can charge. Please pay in full.' },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();

    // Later installments are taken without the family present, which needs a
    // Customer to hang the saved card on.
    let customerId = invoice.plan?.stripeCustomerId || null;
    if (installments && !customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || undefined,
        metadata: { userId: String(user._id) },
      });
      customerId = customer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeCents,
      currency: 'usd',
      payment_method_types: METHODS[method].types,
      // Instant verification only. The micro-deposit fallback strands the
      // payment in requires_action days from now with nobody at the keyboard;
      // a bank it cannot verify instantly should pay by card instead.
      ...(method === 'ach'
        ? { payment_method_options: { us_bank_account: { verification_method: 'instant' } } }
        : {}),
      description: installments
        ? `Dotori School invoice ${invoice.number} — payment 1 of ${installments}`
        : `Dotori School invoice ${invoice.number}`,
      receipt_email: user.email || undefined,
      ...(installments
        ? { customer: customerId, setup_future_usage: 'off_session' }
        : {}),
      metadata: {
        source: 'invoice',
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.number,
        userId: String(user._id),
        method,
        installments: installments ? String(installments) : '',
        installmentNumber: installments ? '1' : '',
        feeCents: String(schedule ? schedule[0].feeCents : totals.adjustmentCents),
      },
    });

    // Remember which intent is outstanding so the webhook can find its way back,
    // and so a second attempt replaces rather than duplicates the record.
    invoice.stripePaymentIntentId = paymentIntent.id;
    invoice.paymentMethod = method;
    invoice.adjustmentCents = totals.adjustmentCents;
    invoice.adjustmentLabel = totals.adjustmentLabel;
    invoice.lastPaymentError = '';
    if (installments) {
      // Recorded now so a family who closes the tab mid-payment still sees the
      // plan they chose; the webhook is what actually starts charging it.
      invoice.plan = {
        ...(invoice.plan?.toObject?.() ?? invoice.plan ?? {}),
        installments,
        chargedCount: 0,
        stripeCustomerId: customerId,
        status: 'active',
        lastError: '',
        failedAttempts: 0,
      };
    }
    await invoice.save();

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      totals,
      method,
      installments,
      chargeCents,
      schedule,
    });
  } catch (err) {
    console.error('Invoice payment intent error:', err);
    // The most common cause in this project is simply that Stripe was never
    // connected; say so rather than showing a generic failure.
    const missingKey = /STRIPE_SECRET_KEY/.test(err?.message || '');
    return Response.json(
      {
        error: missingKey
          ? 'Card and bank payments are not switched on yet. Please contact the school to settle this invoice.'
          : 'Could not start the payment. Please try again.',
      },
      { status: missingKey ? 503 : 500 },
    );
  }
}
