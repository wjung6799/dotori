import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// DELETE /api/admin/families/:id/students  body { studentId?, name? }
// Takes one student off a family's list. History is deliberately untouched:
// bookings, reports, surveys and enrollments all carry the student's NAME, so
// the record of what happened survives — this only stops the student being
// offered anywhere new students are picked.
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: 'Family not found.' }, { status: 404 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const studentId = body?.studentId?.toString();
    const name = body?.name?.toString().trim();
    // Prefer the subdocument id — names can repeat; ids cannot. The name path
    // stays for any row created before students had ids.
    const pull = studentId && mongoose.isValidObjectId(studentId) ? { _id: studentId } : name ? { name } : null;
    if (!pull) {
      return Response.json({ error: 'A student is required.' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findOneAndUpdate(
      { _id: id, role: 'family' },
      { $pull: { students: pull } },
      { new: true },
    ).select('students');
    if (!user) return Response.json({ error: 'Family not found.' }, { status: 404 });

    return Response.json({ ok: true, students: user.students });
  } catch (err) {
    console.error('Student remove error:', err);
    return Response.json({ error: 'Failed to remove the student.' }, { status: 500 });
  }
}
