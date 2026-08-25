import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Invoice from '@/lib/models/Invoice';
import { splitInvoiceIntoInstallments, serializeInvoice, MAX_INSTALLMENTS } from '@/lib/invoicing';
import { getStripe } from '@/lib/stripe';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/family/invoices/:id/split  body { installments: 2 | 3 }
// A family choosing to pay a bill monthly instead of at once. Splitting is
// self-service because needing a payment plan should not require asking.
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

  const count = Math.round(Number(body?.installments));
  if (!Number.isFinite(count) || count < 2 || count > MAX_INSTALLMENTS) {
    return Response.json(
      { error: `Choose between 2 and ${MAX_INSTALLMENTS} monthly payments.` },
      { status: 400 },
    );
  }

  await dbConnect();
  const invoice = await Invoice.findOne({ _id: id, userId: user._id });
  if (!invoice) return Response.json({ error: 'Invoice not found.' }, { status: 404 });

  if (invoice.status !== 'open') {
    return Response.json(
      { error: 'Only an unpaid invoice can be split into payments.' },
      { status: 409 },
    );
  }
  if (invoice.installmentCount) {
    return Response.json(
      { error: 'This is already one payment of a plan — it cannot be split again.' },
      { status: 409 },
    );
  }
  // A previous attempt can leave a live PaymentIntent behind — a declined card is
  // the usual way, and a declined card is exactly when a family wants to spread
  // the cost. Refusing to split would trap them, so cancel the stale intent
  // instead: leaving it confirmable would let it pay an invoice this call is
  // about to void.
  if (invoice.stripePaymentIntentId) {
    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(invoice.stripePaymentIntentId);
      if (intent.status === 'succeeded' || intent.status === 'processing') {
        return Response.json(
          { error: 'A payment on this invoice is still going through. Please wait for it to settle.' },
          { status: 409 },
        );
      }
      if (intent.status !== 'canceled') {
        await stripe.paymentIntents.cancel(invoice.stripePaymentIntentId);
      }
    } catch (err) {
      console.error('Could not cancel the stale intent on', invoice.number, err?.message || err);
      return Response.json(
        { error: 'We could not clear your previous payment attempt. Please contact the school.' },
        { status: 409 },
      );
    }
  }
  // Each instalment still has to clear Stripe's own minimum on its own.
  if (Math.floor(invoice.subtotalCents / count) < 50) {
    return Response.json(
      { error: 'This invoice is too small to split into that many payments.' },
      { status: 400 },
    );
  }

  const created = await splitInvoiceIntoInstallments(invoice, count);

  return Response.json({
    ok: true,
    installments: created.map(serializeInvoice),
  });
}
