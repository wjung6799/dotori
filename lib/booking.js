import { formatInTimeZone } from 'date-fns-tz';
import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import Booking from '@/lib/models/Booking';
import ScheduleException from '@/lib/models/ScheduleException';
import { expandSchedules, minuteLabel, SITE_TIMEZONE } from '@/lib/slots';

// Compute bookable slots for one tutor (or all active tutors if tutorId omitted)
// over the next `days` days, with remaining seats per slot (capacity minus
// scheduled bookings). Returns slots sorted by start time.
export async function getAvailableSlots({ tutorId, days = 28 }) {
  await dbConnect();

  const filter = { active: true };
  if (tutorId) filter.tutorId = tutorId;
  const schedules = await TutorSchedule.find(filter).lean();
  if (schedules.length === 0) return [];

  const now = new Date();
  const to = new Date(now.getTime() + days * 24 * 3600 * 1000);

  let slots = expandSchedules({
    schedules: schedules.map((s) => ({ ...s, id: String(s._id) })),
    from: now,
    to,
  });
  if (slots.length === 0) return [];

  // Drop any occurrence that has a cancellation exception (scheduleId + date).
  const scheduleIdsForExc = schedules.map((s) => s._id);
  const exceptions = await ScheduleException.find({
    scheduleId: { $in: scheduleIdsForExc },
  })
    .select('scheduleId date')
    .lean();
  if (exceptions.length) {
    const cancelled = new Set(exceptions.map((e) => `${e.scheduleId}|${e.date}`));
    slots = slots.filter((s) => !cancelled.has(`${s.scheduleId}|${s.dateKey}`));
    if (slots.length === 0) return [];
  }

  // Count existing scheduled bookings across these schedules in one query.
  const scheduleIds = schedules.map((s) => s._id);
  const bookings = await Booking.find({
    scheduleId: { $in: scheduleIds },
    status: 'scheduled',
    startAt: { $gte: now, $lte: to },
  })
    .select('scheduleId startAt')
    .lean();

  const taken = new Map(); // key `${scheduleId}|${startMs}` -> count
  for (const b of bookings) {
    const key = `${b.scheduleId}|${new Date(b.startAt).getTime()}`;
    taken.set(key, (taken.get(key) || 0) + 1);
  }

  return slots
    .map((slot) => {
      const used = taken.get(`${slot.scheduleId}|${slot.start.getTime()}`) || 0;
      return {
        ...slot,
        remaining: Math.max(0, slot.capacity - used),
        dateLabel: formatInTimeZone(slot.start, SITE_TIMEZONE, 'EEE, MMM d'),
        timeLabel: `${minuteLabel(slot.startMinute)} – ${minuteLabel(
          slot.startMinute + slot.durationMinutes,
        )}`,
      };
    })
    .filter((slot) => slot.remaining > 0);
}
