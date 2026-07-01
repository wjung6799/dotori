import mongoose from 'mongoose';

// A bookable tutor (mirrors a Team-page member). Admin-managed.
const tutorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  specialty: { type: String, default: '' }, // e.g. "Korean Language Learning"
  bio: { type: String, default: '' },
  // Optional link to a login (a tutor who can manage their own bookings later).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Tutor || mongoose.model('Tutor', tutorSchema);
