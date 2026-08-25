import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  category:    { type: String, required: true }, // reading, writing, korean, 1on1, summer
  quarter:     { type: String, required: true }, // e.g. 'fall-2025', 'winter-2026'
  schedule:    { type: String, default: '' },    // e.g. 'Saturdays 10–11am'
  description: { type: String, default: '' },
  price:          { type: Number, required: true }, // regular tuition (or min price for 1:1)
  priceMax:       { type: Number, default: null },  // set for range display (e.g. 1:1 lessons)
  earlyBirdPrice: { type: Number, default: null },  // null = no early bird
  // Fixed fee added when a family pays this class online by card. A set dollar
  // amount per product, not a rate — see PAYMENT_ADJUSTMENT in lib/pricing.js.
  // null means "not set", and the 3% suggestion is used instead.
  onlineFeeCents: { type: Number, default: null },
  capacity:       { type: Number, default: 4 },
  // Links this class to a slot on the public literacy weekly schedule, so the
  // schedule can show live "enrolled/capacity" counts. See lib/literacySlots.js.
  scheduleKey:    { type: String, default: '' },
  // Admin-entered enrolled count. When set (not null) it overrides the
  // automatic Enrollment tally on the public schedule.
  manualEnrolled: { type: Number, default: null },
  active:      { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now },
});

export default mongoose.models.Class || mongoose.model('Class', classSchema);
