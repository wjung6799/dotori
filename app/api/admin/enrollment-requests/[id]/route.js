import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import EnrollmentRequest from '@/lib/models/EnrollmentRequest';
import Enrollment from '@/lib/models/Enrollment';
import Class from '@/lib/models/Class';
import { createClassInvoice } from '@/lib/invoicing';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/enrollment-requests/:id  body { action: 'approve'|'decline', reason?, markPaid? }
// Approving is the moment a seat becomes real and a family becomes billable, so
// it does three things at once: create the Enrollment, raise the Invoice, and
// close the request. Declining just records why.
export async function PATCH(request, { params }) {
  const admin = await getAdminUser();
  if (!admin) return forbidden();

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: 'Request not found.' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  await dbConnect();
  const req = await EnrollmentRequest.findById(id);
  if (!req) return Response.json({ error: 'Request not found.' }, { status: 404 });
  if (req.status !== 'pending') {
    return Response.json({ error: `This request was already ${req.status}.` }, { status: 409 });
  }

  const adminName =
    [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.name || admin.email;

  if (body?.action === 'decline') {
    req.status = 'declined';
    req.declineReason = (body?.reason || '').toString().trim().slice(0, 500);
    req.decidedBy = adminName;
    req.decidedAt = new Date();
    await req.save();
    return Response.json({ ok: true, status: 'declined' });
  }

  if (body?.action !== 'approve') {
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const cls = await Class.findById(req.classId);
  if (!cls) return Response.json({ error: 'That class no longer exists.' }, { status: 404 });

  // Re-check both duplicates and capacity: the request may have sat in the queue
  // while the class filled up or the student was placed by hand.
  const already = await Enrollment.findOne({
    userId: req.userId,
    classId: req.classId,
    studentName: req.studentName,
    paymentStatus: { $ne: 'refunded' },
  });
  if (already) {
    return Response.json(
      { error: 'That student is already enrolled — decline this request instead.' },
      { status: 409 },
    );
  }

  const seated = await Enrollment.countDocuments({
    classId: req.classId,
    paymentStatus: { $in: ['pending', 'paid'] },
  });
  if (seated >= (cls.capacity ?? 0)) {
    return Response.json({ error: `${cls.name} is now full (${seated}/${cls.capacity}).` }, { status: 409 });
  }

  // markPaid means the money already arrived offline, so no bill goes out.
  const markPaid = body?.markPaid === true;

  const enrollment = await Enrollment.create({
    userId: req.userId,
    classId: req.classId,
    studentName: req.studentName,
    quarter: cls.quarter,
    paymentStatus: markPaid ? 'paid' : 'pending',
    amountPaid: Number(cls.price) || 0,
    notes: `Approved from ${req.tutorName || 'instructor'} request`,
    ...(markPaid ? { paidAt: new Date() } : {}),
  });

  let invoice = null;
  if (!markPaid) {
    try {
      invoice = await createClassInvoice({
        user: { _id: req.userId },
        enrollment,
        cls,
        issuedBy: adminName,
        notes: req.note,
      });
    } catch (err) {
      console.error('Invoice creation failed approving request', id, err);
    }
  }

  req.status = 'approved';
  req.decidedBy = adminName;
  req.decidedAt = new Date();
  req.enrollmentId = enrollment._id;
  if (invoice) req.invoiceId = invoice._id;
  await req.save();

  return Response.json({
    ok: true,
    status: 'approved',
    invoice: invoice ? { number: invoice.number, subtotalCents: invoice.subtotalCents } : null,
    invoiceNote: markPaid
      ? 'Marked paid — no invoice raised.'
      : invoice
        ? null
        : 'No invoice: this class has no price set.',
  });
}
