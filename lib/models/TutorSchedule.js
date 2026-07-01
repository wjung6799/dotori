import mongoose from 'mongoose';

// A recurring weekly availability slot for a tutor (or a one-off if specificDate
// is set). Times are interpreted in the site timezone (see lib/slots.js).
// Admin-managed. The slot expander turns these into concrete bookable dates.
const tutorScheduleSchema = new mongoose.Schema({
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', required: true },
  // How this slot repeats:
  //  weekly  → every week on dayOfWeek
  //  weekday → every Mon–Fri
  //  daily   → every day
  //  monthly → every month on dayOfMonth
  //  oneoff  → only on specificDate
  recurrence: {
    type: String,
    enum: ['weekly', 'weekday', 'daily', 'monthly', 'oneoff'],
    default: 'weekly',
  },
  dayOfWeek: { type: Number, required: true }, // 0=Sun .. 6=Sat (used by 'weekly')
  dayOfMonth: { type: Number, default: null }, // 1..31 (used by 'monthly')
  startMinute: { type: Number, required: true }, // minutes from midnight, e.g. 15:00 = 900
  durationMinutes: { type: Number, default: 60 },
  capacity: { type: Number, default: 1 }, // seats per occurrence (1 = 1:1 tutoring)
  subject: { type: String, default: '' }, // optional label shown to families
  specificDate: { type: String, default: null }, // 'YYYY-MM-DD' (used by 'oneoff')
  active: { type: Boolean, default: true },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

tutorScheduleSchema.index({ tutorId: 1, active: 1 });

export default mongoose.models.TutorSchedule ||
  mongoose.model('TutorSchedule', tutorScheduleSchema);
