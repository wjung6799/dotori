import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import Invoice from '@/lib/models/Invoice';
import { removeSeatFromInvoice } from '@/lib/invoicing';
import User from '@/lib/models/User';   // registers model for populate()
import Class from '@/lib/models/Class'; // registers model for populate()
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/admin/enrollments/:id: update payment status, price, or notes
export async function PUT(request, { params }) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json();
    const { paymentStatus, notes, amountPaid } = body || {};
    const update = {};
    if (paymentStatus) {
      update.paymentStatus = paymentStatus;
      if (paymentStatus === 'paid') update.paidAt = new Date();
    }
    if (amountPaid !== undefined && amountPaid !== '') update.amountPaid = Number(amountPaid);
    if (notes !== undefined) update.notes = notes;

    await dbConnect();
    void User;
    void Class;
    const enrollment = await Enrollment.findByIdAndUpdate(id, update, { new: true })
      .populate('userId', 'firstName lastName email name students')
      .populate('classId', 'name');
    return Response.json({ ok: true, enrollment });
  } catch (err) {
    console.error('Enrollment update error:', err);
    return Response.json({ error: 'Failed to update enrollment.' }, { status: 500 });
  }
}

// DELETE /api/admin/enrollments/:id — drop the student from the class. Seat
// counts count enrollment rows, so the seat frees itself. The linked invoice
// follows the money: still open → voided with it; a bank transfer mid-clearing
// blocks the drop (money is in flight and cannot be un-asked); already paid →
// left alone, because the money conversation (refund) is its own decision.
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const { id } = await params;
    await dbConnect();
    const enrollment = await Enrollment.findById(id);
    if (!enrollment) return Response.json({ error: 'Enrollment not found.' }, { status: 404 });

    // The seat may be the primary enrollment of its bill or one merged into it,
    // so match either link.
    const invoice = await Invoice.findOne({
      $or: [{ enrollmentId: enrollment._id }, { enrollmentIds: enrollment._id }],
      status: { $in: ['open', 'processing'] },
    });
    if (invoice?.status === 'processing') {
      return Response.json(
        { error: `A bank transfer for invoice ${invoice.number} is still clearing. Wait for it to land (or fail), then remove the seat.` },
        { status: 409 },
      );
    }

    // Delete the seat FIRST, so the discount recompute below counts the family's
    // state WITHOUT it — otherwise a dropped sibling still triggers its discount.
    await enrollment.deleteOne();

    let voidedInvoice = null;
    if (invoice) {
      const { voided } = await removeSeatFromInvoice({ invoice, enrollmentId: enrollment._id });
      if (voided) voidedInvoice = invoice.number;
    }

    return Response.json({ ok: true, voidedInvoice });
  } catch (err) {
    console.error('Enrollment delete error:', err);
    return Response.json({ error: 'Failed to delete enrollment.' }, { status: 500 });
  }
}
