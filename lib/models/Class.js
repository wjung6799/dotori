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
  // Books and materials, billed as their own invoice line rather than folded
  // into the tuition. The published sheet quotes them separately ("$695 plus
  // $30 materials fee"), and a family that reads one figure on the sheet and a
  // different one on the bill assumes the school got it wrong. 0 = materials
  // are inside the tuition, which is true of every class but Korean Phonics.
  materialsFee:   { type: Number, default: 0 },
  // Named pricing options beside the catalog price. When the office assigns a
  // seat it may pick one, and ONLY the invoice follows it — the class stays a
  // single catalog entry. This is where a family's negotiated 1:1 rate lives,
  // instead of a shadow class per price.
  priceOptions: {
    type: [
      new mongoose.Schema(
        {
          label: { type: String, required: true, trim: true },
          price: { type: Number, required: true, min: 1 },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
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
