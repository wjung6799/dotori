// Who may change a feedback note after it's sent: an admin can touch any note;
// a tutor only the ones written under their own profile. Used by both the list
// route (to flag rows) and the [id] route (to gate PATCH/DELETE).
export function canEditFeedback(fb, user, tutor) {
  if (user?.role === 'admin') return true;
  return Boolean(tutor && fb.tutorId && String(fb.tutorId) === String(tutor._id));
}
