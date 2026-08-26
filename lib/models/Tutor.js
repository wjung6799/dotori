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
  // The total is never stored — it is derived from the size, the hourly rate and
  // the lesson length, so a rate change can never leave a stale price behind.
  rates: {
    type: [
      new mongoose.Schema(
        {
          sessions: { type: Number, required: true, min: 1 },
          ratePerHour: { type: Number, required: true, min: 0 },
          // The billed length of ONE lesson in this package. null falls back to
          // the school-wide HOURS_PER_SESSION. Per package rather than per tutor
          // because one instructor can sell more than one length: Mrs. Jung's
          // weekday 1:1 lessons are 60 minutes and her Saturday blocks are 90,
          // and the hourly rate only becomes a price once you know which.
          hoursPerSession: { type: Number, default: null, min: 0.25 },
          // What the family sees on the card, e.g. "One quarter · 1:1 Private".
          // Blank derives "12-Session Package" from the size, which is the right
          // name for a school that sells only one kind of lesson and the wrong
          // one for a school that sells two.
          name: { type: String, default: '' },
          tag: { type: String, default: '' }, // e.g. "Best value"
          // Which kind of session this package buys. Semi-private and private
          // are priced differently, so a package has to pick one.
          sessionType: { type: String, enum: ['semi_private', 'private'], default: 'semi_private' },
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
