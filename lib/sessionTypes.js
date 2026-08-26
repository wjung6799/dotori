// The one place the session vocabulary is defined.
//
// A tutoring session is either semi-private (a small group sharing the slot) or
// private (one family, the whole slot). They are different products at different
// rates, so the distinction has to run all the way through: what a tutor sells,
// what a family buys, what a slot is opened as, and what a booking spends.
//
// Separately from this, a family can still take a semi-private slot exclusively
// for two credits (Booking.isPrivate). That is a different thing — buying out a
// group slot, not booking a private opening — and it is left untouched, because
// tutors differ on whether they offer it.

export const SEMI_PRIVATE = 'semi_private';
export const PRIVATE = 'private';

export const SESSION_TYPES = [SEMI_PRIVATE, PRIVATE];

export const SESSION_TYPE_LABEL = {
  [SEMI_PRIVATE]: 'Semi-private',
  [PRIVATE]: 'Private (1:1)',
};

export const SESSION_TYPE_BLURB = {
  [SEMI_PRIVATE]: 'A small group shares the slot, each student on their own plan.',
  [PRIVATE]: 'One student, the whole slot, undivided attention.',
};

export function sessionTypeLabel(t) {
  return SESSION_TYPE_LABEL[t] || 'Session';
}

export function isSessionType(t) {
  return SESSION_TYPES.includes(t);
}

// What an existing slot must have meant before slots carried a type: a single
// seat is 1:1, anything larger is a group. Used to read legacy rows without a
// migration, so nothing has to be backfilled before this ships.
export function inferSlotType(schedule) {
  if (isSessionType(schedule?.sessionType)) return schedule.sessionType;
  return (schedule?.capacity ?? 1) <= 1 ? PRIVATE : SEMI_PRIVATE;
}

// The kind the tutor actually declared, or null. inferSlotType above always
// answers something; this is for the places that must not present a guess as
// a fact — a label on a slot, or a warning that a family lacks a kind of credit.
export function declaredSlotType(schedule) {
  return isSessionType(schedule?.sessionType) ? schedule.sessionType : null;
}

// Whether a credit may pay for a slot. A credit with no type is one granted
// before types existed: it works for either, because narrowing it later would
// silently void sessions a family already paid for.
export function creditCoversType(creditType, slotType) {
  if (!isSessionType(creditType)) return true;
  return creditType === slotType;
}
