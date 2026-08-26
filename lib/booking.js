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
  isPrivate = false, // book the WHOLE slot exclusively; consumes 2 credits
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

  // Current occupants of this slot (count, any private, and this student's dupe).
  const slotBookings = await Booking.find({
    scheduleId: schedule._id,
    startAt: start,
    status: { $in: HOLDS_SEAT },
  })
    .select('isPrivate userId studentName')
    .lean();
  const used = slotBookings.length;
  const hasPrivate = slotBookings.some((b) => b.isPrivate);
  const capacity = schedule.capacity ?? 1;

  if (isPrivate) {
    // A private session takes the whole slot, so it must be completely empty and
    // free of any standing weekly booking that intends to occupy it.
    if (used > 0) {
      return { ok: false, code: 'occupied', error: 'Someone is already booked in this session, so it can’t be reserved privately.' };
    }
    const seriesHere = await RecurringBooking.exists({ scheduleId: schedule._id, status: 'active' });
    if (seriesHere) {
      return { ok: false, code: 'occupied', error: 'This time has a standing weekly booking, so it can’t be reserved privately.' };
    }
  } else {
    // A private booking locks the entire slot; nobody else can join.
    if (hasPrivate) {
      return { ok: false, code: 'full', error: 'That session is reserved privately and can’t be joined.' };
    }
    if (used >= capacity) {
      return { ok: false, code: 'full', error: 'That session is full.' };
    }
  }

  // Same student, same slot → already booked.
  const dupe = slotBookings.find(
    (b) => String(b.userId) === String(userId) && b.studentName === studentName,
  );
  if (dupe) {
    return { ok: false, code: 'duplicate', error: 'That student is already booked for this session.', booking: dupe };
  }

  // Consume session credits (tutor-specific first, else any-tutor), atomically:
  // 1 for a normal session, 2 for a private one. Free bookings (consumeCredit=
  // false, e.g. diagnostics) skip this entirely so a family's paid balance is
  // never touched. On a partial draw (not enough credits) we roll back.
  const need = isPrivate ? 2 : 1;
  const consumed = []; // SessionCredit docs actually decremented
  const rollback = () =>
    Promise.all(consumed.map((c) => SessionCredit.findByIdAndUpdate(c._id, { $inc: { remainingSessions: 1 } })));

  if (consumeCredit) {
    // An expired grant is not spendable. `null` means no expiry was ever set —
    // every credit issued before expiry existed — so it stays usable forever.
    // Measured against the SESSION's date, not today: booking six weeks out
    // against a pack that lapses next week would spend a credit the family
    // cannot actually use.
    const usableOn = start || new Date();

    // Order matters, and a plain sort cannot express it: in Mongo an ascending
    // sort puts null FIRST, which would burn the never-expiring credits while a
    // pack about to lapse sat untouched. So spend in explicit passes — dated
    // credits soonest-first, then undated ones — and a tutor's own before any
    // that work with anybody.
    const takeOne = (filter, sort) =>
      SessionCredit.findOneAndUpdate(
        { userId, remainingSessions: { $gt: 0 }, ...filter },
        { $inc: { remainingSessions: -1 } },
        { new: true, ...(sort ? { sort } : {}) },
      );

    const consumeOne = async () => {
      for (const tutorFilter of [{ tutorId: schedule.tutorId }, { tutorId: null }]) {
        const expiring = await takeOne(
          { ...tutorFilter, expiresAt: { $ne: null, $gte: usableOn } },
          { expiresAt: 1 },
        );
        if (expiring) return expiring;
        const evergreen = await takeOne({ ...tutorFilter, expiresAt: null });
        if (evergreen) return evergreen;
      }
      return null;
    };

    for (let i = 0; i < need; i++) {
      const c = await consumeOne();
      if (!c) break;
      consumed.push(c);
    }
    if (consumed.length < need && !allowWithoutCredit) {
      await rollback();
      return {
        ok: false,
        code: 'no_credit',
        error: isPrivate
          ? 'A private session uses 2 sessions and you don’t have enough. Please contact us to add sessions to your account.'
          : 'You have no sessions left. Please contact us to add sessions to your account.',
      };
    }
  }

  const creditIds = consumed.map((c) => c._id);
  try {
    const booking = await Booking.create({
      userId,
      studentName,
      tutorId: schedule.tutorId,
      scheduleId: schedule._id,
      recurringId,
      creditId: creditIds[0] || null,
      creditIds,
      isPrivate,
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
      creditId: creditIds[0] || null,
      creditsUsed: consumed.length,
      creditRemaining: consumed.length ? consumed[consumed.length - 1].remainingSessions : null,
      creditConsumed: consumed.length > 0,
    };
  } catch (createErr) {
    await rollback();
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
    .select('scheduleId startAt recurringId isPrivate')
    .lean();

  const taken = new Map(); // key `${scheduleId}|${startMs}` -> count
  const privateSlots = new Set(); // keys that a private booking has locked
  const materializedSeries = new Map(); // key `${scheduleId}|${startMs}` -> Set(recurringId)
  for (const b of bookings) {
    const key = `${b.scheduleId}|${new Date(b.startAt).getTime()}`;
    taken.set(key, (taken.get(key) || 0) + 1);
    if (b.isPrivate) privateSlots.add(key);
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
      // A private booking takes the whole slot, so it's full regardless of count.
      const remaining = privateSlots.has(key) ? 0 : Math.max(0, slot.capacity - used - virtualReserved);
      return {
        ...slot,
        remaining,
        dateLabel: formatInTimeZone(slot.start, SITE_TIMEZONE, 'EEE, MMM d'),
        timeLabel: `${minuteLabel(slot.startMinute)} – ${minuteLabel(
          slot.startMinute + slot.durationMinutes,
        )}`,
      };
    })
    .filter((slot) => slot.remaining > 0);
}
