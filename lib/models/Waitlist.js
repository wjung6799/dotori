import mongoose from 'mongoose';

// Waitlist signups for programs that are full (currently 1:1 sessions with
// Mrs. Jung). Public form on the Private Lessons page; admins review entries
// at /admin/waitlist.
const waitlistSchema = new mongoose.Schema({
  program:     { type: String, default: '1on1' },
  studentName: { type: String, required: true, trim: true },
  grade:       { type: String, required: true, trim: true },
  parentName:  { type: String, required: true, trim: true },
  phone:       { type: String, required: true, trim: true },
  email:       { type: String, required: true, trim: true, lowercase: true },
  subject:     { type: String, required: true, trim: true }, // academic area they want help with
  createdAt:   { type: Date, default: Date.now },
});

waitlistSchema.index({ program: 1, createdAt: -1 });

export default mongoose.models.Waitlist || mongoose.model('Waitlist', waitlistSchema);
