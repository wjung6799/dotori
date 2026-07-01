import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import ScheduleException from '@/lib/models/ScheduleException';
import { buildScheduleFields } from '@/lib/slots';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/schedules?tutorId=... — availability + cancellation exceptions
export async function GET(request) {
  if (!(await getAdminUser())) return forbidden();
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const filter = {};
    if (searchParams.get('tutorId')) filter.tutorId = searchParams.get('tutorId');
    const schedules = await TutorSchedule.find(filter).sort({ dayOfWeek: 1, startMinute: 1 });
    const exceptions = await ScheduleException.find(filter).select('scheduleId date');
    return Response.json({ schedules, exceptions });
  } catch (err) {
    console.error('Schedules fetch error:', err);
    return Response.json({ error: 'Failed to fetch availability.' }, { status: 500 });
  }
}

// POST /api/admin/schedules — create a recurring (or one-off) availability slot
export async function POST(request) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const body = (await request.json()) || {};
    if (!body.tutorId || body.startMinute === undefined) {
      return Response.json({ error: 'tutorId and startMinute are required.' }, { status: 400 });
    }
    const fields = buildScheduleFields(body);
    if (fields.error) return Response.json({ error: fields.error }, { status: 400 });

    await dbConnect();
    const schedule = await TutorSchedule.create({ tutorId: body.tutorId, ...fields });
    return Response.json({ ok: true, schedule });
  } catch (err) {
    console.error('Schedule create error:', err);
    return Response.json({ error: 'Failed to create availability.' }, { status: 500 });
  }
}
