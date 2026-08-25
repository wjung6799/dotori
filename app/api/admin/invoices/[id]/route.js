import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Invoice from '@/lib/models/Invoice';
import Enrollment from '@/lib/models/Enrollment';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/invoices/:id  body { action: 'mark_paid' | 'void' | 'reopen', note? }
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

    if (invoice.enrollmentId) {
      await Enrollment.findByIdAndUpdate(invoice.enrollmentId, {
        paymentStatus: 'paid',
        paidAt: new Date(),
        amountPaid: invoice.subtotalCents / 100,
      });
    }
    return Response.json({ ok: true, status: 'paid' });
  }

  if (action === 'void') {
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
    return Response.json({ ok: true, status: 'void' });
  }

  if (action === 'reopen') {
    if (invoice.status !== 'void') {
      return Response.json({ error: 'Only a voided invoice can be reopened.' }, { status: 409 });
    }
    invoice.status = 'open';
    invoice.voidedAt = null;
    await invoice.save();
    return Response.json({ ok: true, status: 'open' });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
