import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';
import { cancelOccurrence } from '@/lib/schedule-admin';

export const dynamic = 'force-dynamic';

// POST /api/tutor/schedules/:id/cancel-instance — body: { dateKey, reason? }
export async function POST(request, { params }) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  try {
    const { id } = await params;
    const { dateKey, reason } = (await request.json()) || {};
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return Response.json({ error: 'A valid dateKey is required.' }, { status: 400 });
    }
    await dbConnect();
    const schedule = await TutorSchedule.findById(id);
    if (!schedule || String(schedule.tutorId) !== String(tutor._id)) {
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }
    const { cancelledBookings } = await cancelOccurrence({ schedule, dateKey, reason });
    return Response.json({ ok: true, cancelledBookings });
  } catch (err) {
    console.error('Tutor cancel instance error:', err);
    return Response.json({ error: 'Failed to cancel that date.' }, { status: 500 });
  }
}
