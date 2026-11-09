import Booking from '@/lib/models/Booking';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { PRIVATE, SEMI_PRIVATE, isSessionType, inferSlotType } from '@/lib/sessionTypes';

// What kind of session a booking is, spelled out for whoever is looking at it.
//
// Order matters. An assessment is its own thing. A family that bought out a
// semi-private slot (isPrivate, 2 credits) is having a private lesson in a
// group slot. Otherwise the type recorded on the booking wins, because a later
// change to the slot must not rewrite history. Old bookings that never recorded
// a type fall back to what the slot says it is.

const HOLDS_SEAT = ['scheduled', 'completed'];

export function bookingSessionType(booking, schedule) {
  if (booking?.kind === 'diagnostic') return 'assessment';
  if (booking?.isPrivate) return 'buyout';
  if (isSessionType(booking?.sessionType)) return booking.sessionType;
  return schedule ? inferSlotType(schedule) : null;
}

const plain = (b) => (b && typeof b.toObject === 'function' ? b.toObject() : b);
const slotKey = (scheduleId, startAt) => `${String(scheduleId)}|${new Date(startAt).getTime()}`;

// Adds `session` to every booking:
//   { type, label, detail, taken, capacity, others }
// type: 'assessment' | 'buyout' | 'private' | 'semi_private' | null
// others: the other students sharing the slot. Only filled in when
// `showOthers` is set (tutor and admin views); a family never sees another
// family's child.
export async function annotateSessions(bookings, { showOthers = false } = {}) {
  const list = (bookings || []).map(plain);
  const ids = [...new Set(list.map((b) => b.scheduleId?._id || b.scheduleId).filter(Boolean).map(String))];
  if (!list.length) return list;

  const [schedules, mates] = await Promise.all([
    ids.length ? TutorSchedule.find({ _id: { $in: ids } }).select('capacity sessionType').lean() : [],
    ids.length
      ? Booking.find({
          scheduleId: { $in: ids },
          startAt: { $in: [...new Set(list.map((b) => new Date(b.startAt).getTime()))].map((t) => new Date(t)) },
          status: { $in: HOLDS_SEAT },
        })
          .select('scheduleId startAt studentName isPrivate')
          .lean()
      : [],
  ]);

  const scheduleById = new Map(schedules.map((s) => [String(s._id), s]));
  const bySlot = new Map();
  for (const m of mates) {
    const k = slotKey(m.scheduleId, m.startAt);
    if (!bySlot.has(k)) bySlot.set(k, []);
    bySlot.get(k).push(m);
  }

  return list.map((b) => {
    const sid = String(b.scheduleId?._id || b.scheduleId || '');
    const schedule = scheduleById.get(sid) || null;
    const type = bookingSessionType(b, schedule);
    const inSlot = sid ? bySlot.get(slotKey(sid, b.startAt)) || [] : [];
    const others = inSlot.filter((m) => String(m._id) !== String(b._id)).map((m) => m.studentName);
    const capacity = schedule?.capacity ?? null;
    const taken = inSlot.length || 1;

    let label = 'Session';
    let detail = '';
    if (type === 'assessment') {
      label = 'Assessment';
      detail = 'Free intro assessment';
    } else if (type === 'buyout') {
      label = 'Private';
      detail = 'Whole semi-private slot to themselves · 2 credits';
    } else if (type === PRIVATE) {
      label = 'Private (1:1)';
      detail = 'One student';
    } else if (type === SEMI_PRIVATE) {
      label = 'Semi-private';
      const seats = capacity ? `${taken} of ${capacity} ${capacity === 1 ? 'seat' : 'seats'} filled` : `${taken} booked`;
      const mates = showOthers && others.length ? ` · with ${others.join(', ')}` : '';
      detail = `${seats}${mates}`;
    }

    return {
      ...b,
      session: { type, label, detail, taken, capacity, others: showOthers ? others : [] },
    };
  });
}
