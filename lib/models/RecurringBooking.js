import mongoose from 'mongoose';

// A standing weekly booking: the family flips this on once and the
// book-recurring cron keeps their slot booked ~3 weeks ahead, drawing down
// session credits, until they cancel or run out (which flips status to
// 'paused' — buying more credits lets the cron resume it). Each concrete
// session is a normal Booking stamped with recurringId = this doc's _id.
const recurringBookingSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  tutorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', required: true },
  scheduleId:  { type: mongoose.Schema.Types.ObjectId, ref: 'TutorSchedule', required: true },

  status: {
    type: String,
    enum: ['active', 'paused', 'cancelled'],
    default: 'active',
  },
  pausedReason: { type: String, default: '' }, // e.g. 'no_credit', 'schedule_removed'

  // Snapshot of the weekly slot for labeling / availability reservation.
  dayOfWeek:   { type: Number, default: 0 }, // 0=Sun
  startMinute: { type: Number, default: 0 },
  subject:     { type: String, default: '' },

  // Dates the family cancelled individually — the cron must NOT re-book these.
  skipDates: { type: [String], default: [] }, // ["YYYY-MM-DD", ...]

  lastRunAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Availability reservation + cron sweep both query by (scheduleId, status).
recurringBookingSchema.index({ scheduleId: 1, status: 1 });
recurringBookingSchema.index({ userId: 1, status: 1 });

export default mongoose.models.RecurringBooking ||
  mongoose.model('RecurringBooking', recurringBookingSchema);
