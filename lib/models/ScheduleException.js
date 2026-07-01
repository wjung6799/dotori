import mongoose from 'mongoose';

// A single cancelled occurrence of a recurring schedule (Google-Calendar style
// "remove this instance"). The slot expander skips any (scheduleId, date) that
// has an exception. date is "YYYY-MM-DD" in the site timezone.
const scheduleExceptionSchema = new mongoose.Schema({
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorSchedule', required: true },
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', required: true },
  date: { type: String, required: true }, // "YYYY-MM-DD"
  reason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

scheduleExceptionSchema.index({ scheduleId: 1, date: 1 }, { unique: true });

export default mongoose.models.ScheduleException ||
  mongoose.model('ScheduleException', scheduleExceptionSchema);
