import mongoose from 'mongoose';

// A family claiming a seat in a tutor's slot on a specific date. Consumes one
// session credit (creditId) when created; cancelling refunds it.
const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', required: true },
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorSchedule', default: null },
  // Set when this session was created by a standing weekly booking (RecurringBooking._id).
  recurringId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringBooking', default: null },
  // Primary consumed credit (legacy/back-compat). creditIds holds every grant a
  // booking drew down: 1 entry for a normal session, 2 for a private session.
  creditId: { type: mongoose.Schema.Types.ObjectId, ref: 'SessionCredit', default: null },
  creditIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SessionCredit' }], default: [] },
  // A private session: one family books the whole slot exclusively. It occupies
  // all capacity (nobody else can join) and consumes 2 session credits.
  isPrivate: { type: Boolean, default: false },
  // What kind of session this turned out to be. Recorded rather than re-derived,
  // so a later change to a slot cannot rewrite history.
  sessionType: { type: String, enum: ['semi_private', 'private', null], default: null },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  // Mirrors the slot's kind. 'diagnostic' bookings are free (creditId null) and
  // are created by the public no-auth diagnostic route. Default preserves the
  // existing paid-session behaviour for every current caller.
  kind: { type: String, enum: ['session', 'diagnostic'], default: 'session' },
  status: {
    type: String,
    enum: ['scheduled', 'cancelled', 'completed'],
    default: 'scheduled',
  },
  subject: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

bookingSchema.index({ tutorId: 1, startAt: 1 });
bookingSchema.index({ scheduleId: 1, startAt: 1, status: 1 });
bookingSchema.index({ userId: 1, startAt: 1 });
bookingSchema.index({ recurringId: 1, startAt: 1 });

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
