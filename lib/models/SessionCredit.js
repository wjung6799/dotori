import mongoose from 'mongoose';

// A balance of prepaid tutoring sessions for a family. Credits arrive two ways:
// an admin/tutor grants them after an offline payment (e.g. Zelle), or the family
// buys a pack with a card in the portal (/dashboard/credits), in which case the
// Stripe webhook creates the grant. Booking a slot decrements remainingSessions.
// tutorId null = usable with any tutor.
const sessionCreditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', default: null },
  // Which kind of session this credit can book. null = granted before types
  // existed and works for either, because narrowing it later would silently void
  // sessions a family already paid for.
  sessionType: { type: String, enum: ['semi_private', 'private', null], default: null },
  totalSessions: { type: Number, required: true, min: 0 },
  remainingSessions: { type: Number, required: true, min: 0 },
  // When these sessions stop being usable. null = never expires, which is what
  // every credit granted before expiry existed still is — turning it on must not
  // retroactively void what families already hold.
  expiresAt: { type: Date, default: null },
  // The school extends an expiry once as a courtesy ("Do packages expire?" in
  // lib/pricing.js promises exactly that). Recorded so a second ask is a
  // deliberate decision rather than an invisible one.
  extendedAt: { type: Date, default: null },
  extendedBy: { type: String, default: '' },
  // Day-thresholds a reminder has already gone out for (e.g. [30, 7]). Recorded
  // so the daily sweep tells a family once per stage instead of every morning.
  expiryRemindersSent: { type: [Number], default: [] },

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
// The expiry sweep runs on these together.
sessionCreditSchema.index({ expiresAt: 1, remainingSessions: 1 });

export default mongoose.models.SessionCredit ||
  mongoose.model('SessionCredit', sessionCreditSchema);
