import mongoose from 'mongoose';

// A bookable tutor (mirrors a Team-page member). Admin-managed.
const tutorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  specialty: { type: String, default: '' }, // e.g. "Korean Language Learning"
  bio: { type: String, default: '' },
  // Optional link to a login (a tutor who can manage their own bookings later).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // What this tutor charges for session credits. Rates differ per tutor, so a
  // family buying credits picks the tutor first and sees their prices. An empty
  // list falls back to the school-wide defaults in lib/pricing.js.
  //
  // Only the two numbers are stored; the package name and the total are derived
  // from them, so a rate change can never leave a stale price behind.
  rates: {
    type: [
      new mongoose.Schema(
        {
          sessions: { type: Number, required: true, min: 1 },
          ratePerHour: { type: Number, required: true, min: 0 },
          tag: { type: String, default: '' }, // e.g. "Best value"
          // How long the sessions stay usable after purchase. null = the
          // package never lapses. A bigger package needs a longer window: forty
          // weekly sessions cannot be used inside three months.
          validMonths: { type: Number, default: null, min: 1 },
        },
        { _id: false },
      ),
    ],
    default: [],
  },

  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Tutor || mongoose.model('Tutor', tutorSchema);
