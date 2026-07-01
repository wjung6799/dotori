import mongoose from 'mongoose';

// A balance of prepaid tutoring sessions for a family. Payment happens offline
// (e.g. Zelle), so an admin/tutor grants credits manually. Booking a slot
// decrements remainingSessions. tutorId null = usable with any tutor.
const sessionCreditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', default: null },
  totalSessions: { type: Number, required: true, min: 0 },
  remainingSessions: { type: Number, required: true, min: 0 },
  note: { type: String, default: '' }, // e.g. "Paid $200 via Zelle 6/30"
  grantedBy: { type: String, default: '' }, // admin/tutor name for the audit trail
  createdAt: { type: Date, default: Date.now },
});

sessionCreditSchema.index({ userId: 1, remainingSessions: 1 });

export default mongoose.models.SessionCredit ||
  mongoose.model('SessionCredit', sessionCreditSchema);
