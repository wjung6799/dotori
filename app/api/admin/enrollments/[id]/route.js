import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import User from '@/lib/models/User';   // registers model for populate()
import Class from '@/lib/models/Class'; // registers model for populate()
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/admin/enrollments/:id — update payment status, price, or notes
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
      .populate('userId', 'firstName lastName email name')
      .populate('classId', 'name');
    return Response.json({ ok: true, enrollment });
  } catch (err) {
    console.error('Enrollment update error:', err);
    return Response.json({ error: 'Failed to update enrollment.' }, { status: 500 });
  }
}

// DELETE /api/admin/enrollments/:id
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const { id } = await params;
    await dbConnect();
    await Enrollment.findByIdAndDelete(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Enrollment delete error:', err);
    return Response.json({ error: 'Failed to delete enrollment.' }, { status: 500 });
  }
}
