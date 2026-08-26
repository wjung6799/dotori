import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addMinutes, startOfDay } from 'date-fns';

// Single site timezone for interpreting schedule day/time. Override with the
// SITE_TIMEZONE env var (e.g. "America/New_York").
export const SITE_TIMEZONE = process.env.SITE_TIMEZONE || 'America/Los_Angeles';

const DAY_MS = 24 * 3600 * 1000;

// Format minutes-from-midnight as a 12-hour label, e.g. 900 -> "3:00 PM".
export function minuteLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Does a schedule occur on a given local date key ("YYYY-MM-DD")? Handles all
// recurrence types. Backward compatible: a schedule with no `recurrence` is
// treated as one-off if it has specificDate, else weekly.
export function scheduleMatchesDate(s, dateKey) {
  const rec = s.recurrence || (s.specificDate ? 'oneoff' : 'weekly');
  const [y, mo, d] = dateKey.split('-').map(Number);
  const dow = new Date(y, mo - 1, d).getDay();
  switch (rec) {
    case 'oneoff': return s.specificDate === dateKey;
    case 'weekly': return s.dayOfWeek === dow;
    case 'weekday': return dow >= 1 && dow <= 5;
    case 'daily': return true;
    case 'monthly': return s.dayOfMonth === d;
    default: return false;
  }
}

// Validate + normalize a create-slot request body into TutorSchedule fields.
// Returns { error } on invalid input, else the fields to persist.
export function buildScheduleFields(body) {
  const recurrence = body.recurrence || (body.specificDate ? 'oneoff' : 'weekly');
  const startMinute = Number(body.startMinute);
  const durationMinutes = Number(body.durationMinutes) || 60;
  const capacity = Number(body.capacity) || 1;
  const kind = body.kind === 'diagnostic' ? 'diagnostic' : 'session';
  // A slot opens as one kind of session or the other. Unset falls back to what
  // capacity implies, which is how every slot behaved before types existed.
  const sessionType = ['semi_private', 'private'].includes(body.sessionType)
    ? body.sessionType
    : capacity <= 1
      ? 'private'
      : 'semi_private';
  const subject = body.subject || '';
  const notes = body.notes || '';

  let dayOfWeek = body.dayOfWeek !== undefined ? Number(body.dayOfWeek) : 0;
  let dayOfMonth = null;
  let specificDate = null;

  if (recurrence === 'oneoff') {
    specificDate = body.specificDate;
    if (!specificDate || !/^\d{4}-\d{2}-\d{2}$/.test(specificDate)) {
      return { error: 'A valid date is required for a one-off slot.' };
    }
    const [y, mo, d] = specificDate.split('-').map(Number);
    dayOfWeek = new Date(y, mo - 1, d).getDay();
  } else if (recurrence === 'monthly') {
    dayOfMonth = Number(body.dayOfMonth);
    if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) {
      return { error: 'A valid day of month is required for a monthly slot.' };
    }
  } else if (recurrence === 'weekly' && body.dayOfWeek === undefined) {
    return { error: 'dayOfWeek is required for a weekly slot.' };
  }

  return { recurrence, dayOfWeek, dayOfMonth, startMinute, durationMinutes, capacity, kind, sessionType, subject, specificDate, notes };
}

// Short human label for a recurrence type.
export function recurrenceLabel(s) {
  const rec = s.recurrence || (s.specificDate ? 'oneoff' : 'weekly');
  return { weekly: 'weekly', weekday: 'weekdays', daily: 'daily', monthly: 'monthly', oneoff: 'one-off' }[rec] || rec;
}

// Compute the UTC start/end Date for a schedule occurring on a given local
// date key ("YYYY-MM-DD" in SITE_TIMEZONE). Used at booking time.
export function slotTimesForDate(schedule, dateKey, tz = SITE_TIMEZONE) {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const startLocal = addMinutes(new Date(y, mo - 1, d), schedule.startMinute);
  const endLocal = addMinutes(startLocal, schedule.durationMinutes || 60);
  return {
    start: fromZonedTime(startLocal, tz),
    end: fromZonedTime(endLocal, tz),
  };
}

/**
 * Expand recurring/one-off schedules into concrete slot instances in [from, to].
 * - specificDate null  → recurs weekly on dayOfWeek.
 * - specificDate set   → only on that date.
 * dayOfWeek / startMinute are interpreted in `tz`. Slots starting sooner than
 * minLeadMs from `now` are dropped.
 */
export function expandSchedules({
  schedules,
  from,
  to,
  tz = SITE_TIMEZONE,
  now = new Date(),
  minLeadMs = 0, // allow last-minute booking right up to the slot start
}) {
  const minBookable = new Date(now.getTime() + minLeadMs);

  const startDay = startOfDay(toZonedTime(from, tz));
  const endDay = startOfDay(toZonedTime(to, tz));
  const dayCount = Math.ceil((endDay.getTime() - startDay.getTime()) / DAY_MS) + 1;

  const out = [];
  for (let i = 0; i < dayCount; i++) {
    const dayZ = new Date(startDay.getTime() + i * DAY_MS);
    const dayKey = formatInTimeZone(fromZonedTime(dayZ, tz), tz, 'yyyy-MM-dd');

    for (const s of schedules) {
      if (!scheduleMatchesDate(s, dayKey)) continue;
      const startLocal = addMinutes(
        new Date(dayZ.getFullYear(), dayZ.getMonth(), dayZ.getDate()),
        s.startMinute,
      );
      const endLocal = addMinutes(startLocal, s.durationMinutes || 60);
      const startUtc = fromZonedTime(startLocal, tz);
      const endUtc = fromZonedTime(endLocal, tz);
      if (startUtc < minBookable) continue;
      if (startUtc < from || endUtc > to) continue;
      out.push({
        scheduleId: String(s.id ?? s._id),
        tutorId: String(s.tutorId),
        dateKey: dayKey,
        startMinute: s.startMinute,
        durationMinutes: s.durationMinutes || 60,
        capacity: s.capacity ?? 1,
        kind: s.kind || 'session',
        // Semi-private or private. Legacy rows have none, so fall back to what
        // the capacity always implied rather than requiring a backfill.
        sessionType: s.sessionType || ((s.capacity ?? 1) <= 1 ? 'private' : 'semi_private'),
        subject: s.subject || '',
        start: startUtc,
        end: endUtc,
      });
    }
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}
