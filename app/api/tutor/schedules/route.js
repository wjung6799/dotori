import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { buildScheduleFields } from '@/lib/slots';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';

export const dynamic = 'force-dynamic';

// POST /api/tutor/schedules: create one of the signed-in tutor's own slots.
// Recurring: { dayOfWeek, startMinute, ... }. One-off: { specificDate, startMinute, ... }.
export async function POST(request) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  try {
    const body = (await request.json()) || {};
    if (body.startMinute === undefined) {
      return Response.json({ error: 'startMinute is required.' }, { status: 400 });
    }
    const fields = buildScheduleFields(body);
    if (fields.error) return Response.json({ error: fields.error }, { status: 400 });

    await dbConnect();
    const schedule = await TutorSchedule.create({ tutorId: tutor._id, ...fields });
    return Response.json({ ok: true, schedule });
  } catch (err) {
    console.error('Tutor schedule create error:', err);
    return Response.json({ error: 'Failed to add availability.' }, { status: 500 });
  }
}
