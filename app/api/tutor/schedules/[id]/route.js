import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';
import { deleteSeries } from '@/lib/schedule-admin';

export const dynamic = 'force-dynamic';

// DELETE /api/tutor/schedules/:id — delete one of the tutor's own series.
export async function DELETE(request, { params }) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  try {
    const { id } = await params;
    await dbConnect();
    const schedule = await TutorSchedule.findById(id);
    if (!schedule || String(schedule.tutorId) !== String(tutor._id)) {
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }
    const { cancelledBookings } = await deleteSeries({ schedule });
    return Response.json({ ok: true, cancelledBookings });
  } catch (err) {
    console.error('Tutor schedule delete error:', err);
    return Response.json({ error: 'Failed to delete availability.' }, { status: 500 });
  }
}
