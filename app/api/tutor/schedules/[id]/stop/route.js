import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';
import { stopSeries } from '@/lib/schedule-admin';

export const dynamic = 'force-dynamic';

// POST /api/tutor/schedules/:id/stop: stop offering one of the tutor's own
// series from now on, keeping every session already booked on it.
export async function POST(request, { params }) {
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
    const { keptBookings, pausedSeries } = await stopSeries({ schedule });
    return Response.json({ ok: true, keptBookings, pausedSeries });
  } catch (err) {
    console.error('Tutor schedule stop error:', err);
    return Response.json({ error: 'Failed to stop availability.' }, { status: 500 });
  }
}
