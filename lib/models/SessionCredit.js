import mongoose from 'mongoose';

// A balance of prepaid tutoring sessions for a family. Credits arrive two ways:
// an admin/tutor grants them after an offline payment (e.g. Zelle), or the family
// buys a pack with a card in the portal (/dashboard/credits), in which case the
// Stripe webhook creates the grant. Booking a slot decrements remainingSessions.
// tutorId null = usable with any tutor.
const sessionCreditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', default: null },
  totalSessions: { type: Number, required: true, min: 0 },
  remainingSessions: { type: Number, required: true, min: 0 },
  note: { type: String, default: '' }, // e.g. "Paid $200 via Zelle 6/30"
  grantedBy: { type: String, default: '' }, // admin/tutor name for the audit trail
  // Set only for card purchases made in the portal. Unique+sparse so a Stripe
  // webhook redelivery can never grant the same pack twice.
  stripePaymentIntentId: { type: String, default: null },
  packId: { type: String, default: '' }, // CREDIT_PACKS id, for the receipt line
  // What was actually charged to the card, i.e. what shows on their statement.
  amountPaidCents: { type: Number, default: 0 },
  // The online card fee inside that total. Broken out so the pack price stays
  // recoverable and the fee is never mistaken for revenue.
  onlineFeeCents: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// `sparse` skips only documents where the field is ABSENT — an explicitly stored
// null is still indexed, so with `default: null` every unpaid row would collide
// on the second insert. A partial index on the string type ignores nulls
// outright, which is what "unique when set" actually needs.
sessionCreditSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, partialFilterExpression: { stripePaymentIntentId: { $type: 'string' } } },
);

sessionCreditSchema.index({ userId: 1, remainingSessions: 1 });

export default mongoose.models.SessionCredit ||
  mongoose.model('SessionCredit', sessionCreditSchema);
