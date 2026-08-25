import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Invoice from '@/lib/models/Invoice';
import { invoiceTotals, isPayable, STRIPE_MIN_CENTS } from '@/lib/invoicing';
import { ONLINE_METHODS } from '@/lib/pricing';
import { getStripe } from '@/lib/stripe';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Card is the only method the online channel offers — see ONLINE_METHODS in
// lib/pricing.js for why. Bank transfer stays in the map so re-enabling it is a
// one-line change, but a request for it is refused until it is listed there.
const METHODS = {
  card: { types: ['card'], label: 'card' },
  ach: { types: ['us_bank_account'], label: 'bank transfer' },
};

// POST /api/family/invoices/:id/pay  body { method: 'card' | 'ach' }
// Creates the PaymentIntent for one invoice and hands back its client secret.
// The invoice is NOT settled here — only the webhook may do that, so a family
// that abandons the sheet leaves nothing marked paid.
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
  // client sent, so the displayed discount cannot be forged into a real one.
  const totals = invoiceTotals(invoice, method);

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totals.totalCents,
      currency: 'usd',
      payment_method_types: METHODS[method].types,
      description: `Dotori School invoice ${invoice.number}`,
      receipt_email: user.email || undefined,
      metadata: {
        source: 'invoice',
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.number,
        userId: String(user._id),
        method,
        adjustmentCents: String(totals.adjustmentCents),
        adjustmentLabel: totals.adjustmentLabel,
      },
    });

    // Remember which intent is outstanding so the webhook can find its way back,
    // and so a second attempt replaces rather than duplicates the record.
    invoice.stripePaymentIntentId = paymentIntent.id;
    invoice.paymentMethod = method;
    invoice.adjustmentCents = totals.adjustmentCents;
    invoice.adjustmentLabel = totals.adjustmentLabel;
    invoice.lastPaymentError = '';
    await invoice.save();

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      totals,
      method,
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
