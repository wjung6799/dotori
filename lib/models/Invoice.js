import mongoose from 'mongoose';

// A bill the school issues to a family. Created when a student is placed in a
// class (the office assigns the seat; the parent settles the invoice themselves
// in the portal), and payable by bank transfer or card.
//
// Money is stored in CENTS as integers everywhere. Dollars-as-floats is how
// totals drift away from what Stripe actually captured.

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    detail: { type: String, default: '' }, // e.g. the class schedule
    amountCents: { type: Number, required: true },
    // 'tuition' is the thing being sold; 'fee' and 'discount' are adjustments
    // that depend on how the family chooses to pay, so they are added at
    // payment time rather than at issue time.
    kind: { type: String, enum: ['tuition', 'credits', 'fee', 'discount', 'other'], default: 'tuition' },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema({
  // Human-facing identifier (DOT-2026-0001). Unique, and generated through a
  // counter document so two simultaneous enrollments cannot collide.
  number: { type: String, required: true, unique: true },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, default: '' },

  items: { type: [lineItemSchema], default: [] },
  // Sum of the item lines.
  subtotalCents: { type: Number, required: true, min: 0 },
  // The online card fee for this bill, copied from the class when the invoice
  // was raised. Snapshotted deliberately: repricing a class must not silently
  // change what an invoice already sent to a family asks for.
  onlineFeeCents: { type: Number, default: null },

  status: {
    type: String,
    // open      → sent, awaiting payment
    // processing→ ACH debit submitted; money has not settled yet
    // paid      → settled
    // void      → cancelled by the school, no longer owed
    enum: ['open', 'processing', 'paid', 'void'],
    default: 'open',
    index: true,
  },

  dueAt: { type: Date, default: null },

  // ── Payment, filled in as the family pays ──────────────────────
  paymentMethod: { type: String, enum: ['card', 'ach', 'offline', null], default: null },
  // Signed adjustment for how they chose to pay: negative is a discount
  // (bank transfer), positive would be a surcharge. Deliberately mode-neutral —
  // see PAYMENT_ADJUSTMENT in lib/pricing.js — so switching between the two
  // framings does not need a migration. Zero until the invoice is paid, because
  // the amount is not knowable before the method is chosen.
  adjustmentCents: { type: Number, default: 0 },
  adjustmentLabel: { type: String, default: '' },
  totalPaidCents: { type: Number, default: 0 },
  // Unique+sparse: a Stripe webhook redelivery must not re-settle an invoice.
  stripePaymentIntentId: { type: String, default: null },
  lastPaymentError: { type: String, default: '' },

  // ── What this invoice is for ───────────────────────────────────
  enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', default: null },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  quarter: { type: String, default: '' },

  // Every charge made against this invoice, in order.
  payments: {
    type: [
      new mongoose.Schema(
        {
          at: { type: Date, default: Date.now },
          amountCents: { type: Number, required: true },
          feeCents: { type: Number, default: 0 },
          stripePaymentIntentId: { type: String, default: '' },
        },
        { _id: false },
      ),
    ],
    default: [],
  },

  notes: { type: String, default: '' },
  issuedBy: { type: String, default: '' }, // admin name, for the audit trail

  issuedAt: { type: Date, default: Date.now },
  paidAt: { type: Date, default: null },
  voidedAt: { type: Date, default: null },
});

invoiceSchema.index({ userId: 1, status: 1, issuedAt: -1 });
// `sparse` skips only documents where the field is ABSENT — an explicitly stored
// null is still indexed, so with `default: null` every unpaid row would collide
// on the second insert. A partial index on the string type ignores nulls
// outright, which is what "unique when set" actually needs.
invoiceSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, partialFilterExpression: { stripePaymentIntentId: { $type: 'string' } } },
);

export default mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
