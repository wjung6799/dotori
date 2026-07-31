import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';

export const dynamic = 'force-dynamic';

// DELETE /api/tutor/credits/:id: remove a session grant scoped to this tutor.
export async function DELETE(request, { params }) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  try {
    const { id } = await params;
    await dbConnect();
    const credit = await SessionCredit.findOne({ _id: id, tutorId: tutor._id });
    if (!credit) return Response.json({ error: 'Not found.' }, { status: 404 });
    await SessionCredit.findByIdAndDelete(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Tutor credit delete error:', err);
    return Response.json({ error: 'Failed to remove sessions.' }, { status: 500 });
  }
}
