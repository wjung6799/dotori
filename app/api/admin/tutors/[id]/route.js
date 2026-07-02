import dbConnect from '@/lib/db';
import Tutor from '@/lib/models/Tutor';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/admin/tutors/:id
export async function PUT(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    const body = (await request.json()) || {};
    const update = {};
    for (const k of ['name', 'specialty', 'bio', 'active', 'sortOrder']) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    if (body.slug !== undefined) {
      update.slug = body.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    await dbConnect();
    const tutor = await Tutor.findByIdAndUpdate(id, update, { new: true });
    if (!tutor) return Response.json({ error: 'Tutor not found.' }, { status: 404 });
    return Response.json({ ok: true, tutor });
  } catch (err) {
    console.error('Tutor update error:', err);
    return Response.json({ error: 'Failed to update tutor.' }, { status: 500 });
  }
}

// DELETE /api/admin/tutors/:id — also removes the tutor's availability slots.
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    await Tutor.findByIdAndDelete(id);
    await TutorSchedule.deleteMany({ tutorId: id });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Tutor delete error:', err);
    return Response.json({ error: 'Failed to delete tutor.' }, { status: 500 });
  }
}
