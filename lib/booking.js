import { formatInTimeZone } from 'date-fns-tz';
import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import Booking from '@/lib/models/Booking';
import SessionCredit from '@/lib/models/SessionCredit';
import RecurringBooking from '@/lib/models/RecurringBooking';
import ScheduleException from '@/lib/models/ScheduleException';
import {
  expandSchedules,
  minuteLabel,
  scheduleMatchesDate,
  slotTimesForDate,
  SITE_TIMEZONE,
} from '@/lib/slots';

// A seat is held by a session that is still on the books or already happened;
// cancelled ones free their seat back up.
const HOLDS_SEAT = ['scheduled', 'completed'];

// Book one session for a family into a schedule on a specific local date, doing
// the same capacity → dedupe → atomic credit-consume → create-with-rollback
// dance the interactive route needs, so the recurring cron can reuse it verbatim.
// Returns { ok:true, booking, start, end, creditId, creditRemaining } on success,
// or { ok:false, code, error } where code is one of:
//   'schedule_unavailable' | 'not_offered' | 'past' | 'full' | 'duplicate' | 'no_credit' | 'error'
export async function attemptBooking({
  userId,
  studentName,
  schedule,
  dateKey,
  recurringId = null,
  minLeadMs = 0,
  allowWithoutCredit = false, // tutor booking on behalf: book even at 0 balance
  allowPast = false, // tutor logging a session the student actually attended
  status = 'scheduled', // 'completed' when logging attendance after the fact
  consumeCredit = true, // false for free bookings (diagnostics); never touch credits
  kind = 'session', // 'diagnostic' for the free intro assessment
}) {
  if (!schedule || !schedule.active) {
    return { ok: false, code: 'schedule_unavailable', error: 'That time is no longer available.' };
  }
  if (!scheduleMatchesDate(schedule, dateKey)) {
    return { ok: false, code: 'not_offered', error: 'That time is not offered on that date.' };
  }

  const { start, end } = slotTimesForDate(schedule, dateKey);
  if (!allowPast && start.getTime() < Date.now() + minLeadMs) {
    return { ok: false, code: 'past', error: 'That time has already passed.' };
  }

  // Capacity check.
  const used = await Booking.countDocuments({
    scheduleId: schedule._id,
    startAt: start,
    status: { $in: HOLDS_SEAT },
  });
  if (used >= (schedule.capacity ?? 1)) {
    return { ok: false, code: 'full', error: 'That session is full.' };
  }

  // Same student, same slot → already booked.
  const dupe = await Booking.findOne({
    userId,
    scheduleId: schedule._id,
    startAt: start,
    studentName,
    status: { $in: HOLDS_SEAT },
  });
  if (dupe) {
    return { ok: false, code: 'duplicate', error: 'That student is already booked for this session.', booking: dupe };
  }

  // Consume one session credit (tutor-specific first, else any-tutor), atomically.
  // Free bookings (consumeCredit=false, e.g. diagnostics) skip this entirely so a
  // family's paid balance is never touched, even if they happen to have credits.
  let credit = null;
  if (consumeCredit) {
    credit = await SessionCredit.findOneAndUpdate(
      { userId, tutorId: schedule.tutorId, remainingSessions: { $gt: 0 } },
      { $inc: { remainingSessions: -1 } },
      { new: true },
    );
    if (!credit) {
      credit = await SessionCredit.findOneAndUpdate(
        { userId, tutorId: null, remainingSessions: { $gt: 0 } },
        { $inc: { remainingSessions: -1 } },
        { new: true },
      );
    }
    if (!credit && !allowWithoutCredit) {
      return {
        ok: false,
        code: 'no_credit',
        error: 'You have no sessions left. Please contact us to add sessions to your account.',
      };
    }
  }

  try {
    const booking = await Booking.create({
      userId,
      studentName,
      tutorId: schedule.tutorId,
      scheduleId: schedule._id,
      recurringId,
      creditId: credit ? credit._id : null,
      startAt: start,
      endAt: end,
      status,
      kind,
      subject: schedule.subject || '',
    });
    return {
      ok: true,
      booking,
      start,
      end,
      creditId: credit ? credit._id : null,
      creditRemaining: credit ? credit.remainingSessions : null,
      creditConsumed: Boolean(credit),
    };
  } catch (createErr) {
    // Roll the credit back if the booking insert failed.
    if (credit) await SessionCredit.findByIdAndUpdate(credit._id, { $inc: { remainingSessions: 1 } });
    return { ok: false, code: 'error', error: 'Failed to book the session.' };
  }
}

// Compute bookable slots for one tutor (or all active tutors if tutorId omitted)
// over the next `days` days, with remaining seats per slot (capacity minus
// scheduled bookings). Returns slots sorted by start time.
export async function getAvailableSlots({ tutorId, days = 28, kind = 'session' }) {
  const now = new Date();
  return slotsWithSeats({
    tutorId,
    from: now,
    to: new Date(now.getTime() + days * 24 * 3600 * 1000),
    kind,
  });
}

// Occurrences of a tutor's slots over the last `days` days that still have a
// free seat: the picklist for logging a student who attended without booking.
// Newest first, since the session being logged is usually a recent one. Standing
// weekly bookings reserve nothing here: the past is already settled.
export async function getPastSlots({ tutorId, days = 30 }) {
  const now = new Date();
  const slots = await slotsWithSeats({
    tutorId,
    from: new Date(now.getTime() - days * 24 * 3600 * 1000),
    to: now,
    reserveRecurring: false,
    kind: 'session', // never surface free diagnostic slots in the paid attendance picker
  });
  return slots.reverse();
}

// Shared core of the two above: expand schedules over [from, to], drop cancelled
// occurrences, and subtract seats already taken.
async function slotsWithSeats({ tutorId, from, to, reserveRecurring = true, kind }) {
  await dbConnect();

  const filter = { active: true };
  if (tutorId) filter.tutorId = tutorId;
  // Separate paid slots from free diagnostic slots. Legacy docs predate the
  // `kind` field, so treat a missing/null kind as 'session'. Omitting `kind`
  // (e.g. the tutor's past-attendance picker) returns every kind.
  if (kind === 'diagnostic') filter.kind = 'diagnostic';
  else if (kind === 'session') filter.$or = [{ kind: 'session' }, { kind: { $exists: false } }, { kind: null }];
  const schedules = await TutorSchedule.find(filter).lean();
  if (schedules.length === 0) return [];

  let slots = expandSchedules({
    schedules: schedules.map((s) => ({ ...s, id: String(s._id) })),
    from,
    to,
    now: from, // the window start is the floor, so a past window isn't emptied
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
    status: { $in: HOLDS_SEAT },
    startAt: { $gte: from, $lte: to },
  })
    .select('scheduleId startAt recurringId')
    .lean();

  const taken = new Map(); // key `${scheduleId}|${startMs}` -> count
  const materializedSeries = new Map(); // key `${scheduleId}|${startMs}` -> Set(recurringId)
  for (const b of bookings) {
    const key = `${b.scheduleId}|${new Date(b.startAt).getTime()}`;
    taken.set(key, (taken.get(key) || 0) + 1);
    if (b.recurringId) {
      if (!materializedSeries.has(key)) materializedSeries.set(key, new Set());
      materializedSeries.get(key).add(String(b.recurringId));
    }
  }

  // Reserve a virtual seat for each active standing weekly booking on its future
  // occurrences that haven't been materialized yet, so a one-off booker can't
  // take the recurring family's slot before the rolling cron books it.
  const activeSeries = reserveRecurring
    ? await RecurringBooking.find({ scheduleId: { $in: scheduleIds }, status: 'active' })
        .select('scheduleId')
        .lean()
    : [];
  const seriesBySchedule = new Map(); // scheduleId -> [seriesId, ...]
  for (const rb of activeSeries) {
    const sid = String(rb.scheduleId);
    if (!seriesBySchedule.has(sid)) seriesBySchedule.set(sid, []);
    seriesBySchedule.get(sid).push(String(rb._id));
  }

  return slots
    .map((slot) => {
      const key = `${slot.scheduleId}|${slot.start.getTime()}`;
      const used = taken.get(key) || 0;
      // Series intending to occupy this slot that don't already hold a booking here.
      const seriesHere = seriesBySchedule.get(String(slot.scheduleId)) || [];
      const alreadyBooked = materializedSeries.get(key) || new Set();
      const virtualReserved = seriesHere.filter((id) => !alreadyBooked.has(id)).length;
      return {
        ...slot,
        remaining: Math.max(0, slot.capacity - used - virtualReserved),
        dateLabel: formatInTimeZone(slot.start, SITE_TIMEZONE, 'EEE, MMM d'),
        timeLabel: `${minuteLabel(slot.startMinute)} – ${minuteLabel(
          slot.startMinute + slot.durationMinutes,
        )}`,
      };
    })
    .filter((slot) => slot.remaining > 0);
}
