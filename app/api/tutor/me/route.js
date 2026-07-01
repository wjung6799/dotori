import TutorSchedule from '@/lib/models/TutorSchedule';
import ScheduleException from '@/lib/models/ScheduleException';
import { getTutorOrAdmin, unauthorized } from '@/lib/auth-helpers';
import { getMyTutor } from '@/lib/tutor-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tutor/me — the signed-in tutor's profile + their schedules/exceptions.
export async function GET() {
  if (!(await getTutorOrAdmin())) return unauthorized();
  const { tutor } = await getMyTutor();
  if (!tutor) return Response.json({ tutor: null, schedules: [], exceptions: [] });

  const schedules = await TutorSchedule.find({ tutorId: tutor._id }).sort({
    dayOfWeek: 1,
    startMinute: 1,
  });
  const exceptions = await ScheduleException.find({ tutorId: tutor._id }).select('scheduleId date');
  return Response.json({ tutor, schedules, exceptions });
}
