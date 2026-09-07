import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Invoice from '@/lib/models/Invoice';
import Enrollment from '@/lib/models/Enrollment';
import SessionCredit from '@/lib/models/SessionCredit';
import { activateInvoiceCredit, releaseInvoiceCredit, sendInvoiceEmail } from '@/lib/invoicing';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/invoices/:id  body { action: 'mark_paid' | 'void' | 'reopen' | 'send', note? }
// The office still takes Zelle and cash, so an invoice has to be settleable by
// hand — and cancellable when a placement falls through.
export async function PATCH(request, { params }) {
  const admin = await getAdminUser();
  if (!admin) return forbidden();

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

  await dbConnect();
  const invoice = await Invoice.findById(id);
  if (!invoice) return Response.json({ error: 'Invoice not found.' }, { status: 404 });

  const note = (body?.note || '').toString().trim().slice(0, 500);
  const action = body?.action;

  if (action === 'mark_paid') {
    if (invoice.status === 'paid') {
      return Response.json({ error: 'Already paid.' }, { status: 409 });
    }
    // A voided assignment's session pack is gone; reopen first — that path
    // checks the pack still exists before the bill can look payable again.
    if (invoice.status === 'void') {
      return Response.json({ error: 'This invoice is void. Reopen it first.' }, { status: 409 });
    }
    // A bank debit in flight must not be hand-settled: if the debit later fails
    // the school would believe it had been paid twice over.
    if (invoice.status === 'processing') {
      return Response.json(
        { error: 'A bank transfer is still clearing on this invoice. Wait for it to settle or fail.' },
        { status: 409 },
      );
    }
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.paymentMethod = 'offline';
    invoice.adjustmentCents = 0;
    invoice.adjustmentLabel = '';
    invoice.totalPaidCents = invoice.subtotalCents;
    if (note) invoice.notes = note;
    invoice.issuedBy = invoice.issuedBy || '';
    await invoice.save();

    const settleIds = invoice.enrollmentIds?.length
      ? invoice.enrollmentIds
      : invoice.enrollmentId
        ? [invoice.enrollmentId]
        : [];
    if (settleIds.length) {
      await Enrollment.updateMany(
        { _id: { $in: settleIds } },
        { paymentStatus: 'paid', paidAt: new Date() },
      );
    }
    // An assigned session pack rides this bill: money in → sessions on.
    await activateInvoiceCredit(invoice);
    return Response.json({ ok: true, status: 'paid' });
  }

  if (action === 'void') {
    // A bank debit in flight WILL land days from now; voiding underneath it
    // would delete the pending session pack and then have the webhook settle a
    // void bill — money taken, sessions gone. Same reason mark_paid refuses.
    if (invoice.status === 'processing') {
      return Response.json(
        { error: 'A bank transfer is still clearing on this invoice. Wait for it to settle or fail.' },
        { status: 409 },
      );
    }
    if (invoice.status === 'paid') {
      return Response.json(
        { error: 'A paid invoice cannot be voided — refund it in Stripe instead.' },
        { status: 409 },
      );
    }
    invoice.status = 'void';
    invoice.voidedAt = new Date();
    if (note) invoice.notes = note;
    await invoice.save();
    // Only after the void is durable does the unfulfilled session pack go.
    await releaseInvoiceCredit(invoice);
    return Response.json({ ok: true, status: 'void' });
  }

  if (action === 'send') {
    // Email the family the bill as it stands now. Only a live bill is worth
    // sending; a void one is not owed, and paid/processing have already moved.
    if (invoice.status !== 'open') {
      return Response.json({ error: 'Only an open invoice can be sent.' }, { status: 409 });
    }
    const summary = (invoice.items.find((it) => it.kind === 'tuition')?.description || '').split(' — ')[0];
    let sent = false;
    try {
      sent = await sendInvoiceEmail(invoice, summary);
    } catch (err) {
      console.error('Invoice send failed:', invoice.number, err?.message || err);
      return Response.json({ error: 'The email could not be sent. Try again.' }, { status: 502 });
    }
    if (!sent) {
      return Response.json({ error: 'This family has no email on file.' }, { status: 400 });
    }
    invoice.sentAt = new Date();
    await invoice.save();
    return Response.json({ ok: true, sentAt: invoice.sentAt });
  }

  if (action === 'reopen') {
    if (invoice.status !== 'void') {
      return Response.json({ error: 'Only a voided invoice can be reopened.' }, { status: 409 });
    }
    // Voiding an assignment deleted its pending session pack; an invoice whose
    // promise is gone must not come back looking payable.
    if (invoice.creditId && !(await SessionCredit.exists({ _id: invoice.creditId }))) {
      return Response.json(
        { error: 'The session pack on this invoice was cancelled with it. Assign the sessions again instead.' },
        { status: 409 },
      );
    }
    invoice.status = 'open';
    invoice.voidedAt = null;
    await invoice.save();
    return Response.json({ ok: true, status: 'open' });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
