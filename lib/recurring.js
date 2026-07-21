import { formatInTimeZone } from 'date-fns-tz';
import { attemptBooking } from '@/lib/booking';
import { expandSchedules, SITE_TIMEZONE } from '@/lib/slots';

// How far ahead a standing weekly booking holds concrete sessions. The cron
// rolls this window forward each run; the virtual-seat reservation in
// getAvailableSlots protects the family's slot beyond it.
export const RECURRING_HORIZON_DAYS = 21;

export function whenLabel(start, end) {
  return (
    `${formatInTimeZone(start, SITE_TIMEZONE, 'EEE, MMM d, yyyy · h:mm a')}` +
    ` – ${formatInTimeZone(end, SITE_TIMEZONE, 'h:mm a')}`
  );
}

// Book every occurrence of `series`' schedule inside the horizon that isn't
// already booked or individually skipped, drawing down credits. Mutates and
// saves the series (lastRunAt, and status→paused with pausedReason='no_credit'
// when credits run out). Returns { booked:[], skipped:[], paused, pausedReason }.
// `booked`/`skipped` items: { dateKey, start, end, label, reason? }.
export async function fillRecurringSeries({
  series,
  schedule,
  now = new Date(),
  from = now, // window start — the interactive path passes the picked slot's start
  horizonDays = RECURRING_HORIZON_DAYS,
}) {
  const booked = [];
  const skipped = [];
  let paused = false;
  let pausedReason = '';

  if (schedule && schedule.active) {
    const base = from.getTime() < now.getTime() ? now : from;
    const to = new Date(base.getTime() + horizonDays * 24 * 3600 * 1000);
    const occurrences = expandSchedules({
      schedules: [{ ...(schedule.toObject ? schedule.toObject() : schedule), id: String(schedule._id) }],
      from: base,
      to,
    });

    const skip = new Set(series.skipDates || []);

    for (const occ of occurrences) {
      if (skip.has(occ.dateKey)) continue; // family cancelled this week on purpose

      const res = await attemptBooking({
        userId: series.userId,
        studentName: series.studentName,
        schedule,
        dateKey: occ.dateKey,
        recurringId: series._id,
      });

      if (res.ok) {
        booked.push({ dateKey: occ.dateKey, start: res.start, end: res.end, label: whenLabel(res.start, res.end) });
      } else if (res.code === 'no_credit') {
        paused = true;
        pausedReason = 'no_credit';
        break; // stop at the first week we can't afford
      } else if (res.code === 'full' || res.code === 'not_offered') {
        skipped.push({ dateKey: occ.dateKey, start: occ.start, end: occ.end, label: whenLabel(occ.start, occ.end), reason: res.code });
      }
      // 'duplicate' → already booked (silent); 'past'/'error' → skip silently
    }
  } else {
    // Underlying slot was deleted/deactivated — stop the series.
    paused = true;
    pausedReason = 'schedule_removed';
  }

  series.lastRunAt = now;
  if (paused) {
    // Ran out of sessions (or the slot vanished) — pause.
    series.status = 'paused';
    series.pausedReason = pausedReason;
  } else if (booked.length && series.status === 'paused') {
    // Was paused for lack of credits and we just booked again — resume.
    series.status = 'active';
    series.pausedReason = '';
  }
  await series.save();

  return { booked, skipped, paused, pausedReason };
}
