import Counter from '@/lib/models/Counter';
import Invoice from '@/lib/models/Invoice';
import Enrollment from '@/lib/models/Enrollment';
import SessionCredit from '@/lib/models/SessionCredit';
import User from '@/lib/models/User';
import { quoteFor, convenienceFeeFor } from '@/lib/pricing';
import { sendInvoiceIssued } from '@/lib/mailer';

// Invoice numbers are DOT-<year>-<4 digits>, minted from an atomic counter so
// two seats assigned in the same second cannot collide. Counting existing
// invoices would race.
export async function nextInvoiceNumber(now = new Date()) {
  const year = now.getFullYear();
  const doc = await Counter.findByIdAndUpdate(
    `invoice-${year}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `DOT-${year}-${String(doc.seq).padStart(4, '0')}`;
}

// Create an invoice, re-minting its number if the counter has drifted out of
// step with what is already stored (a restored dump, a hand-inserted row). The
// counter is normally authoritative, but a hard 500 on a duplicate number would
// block a family from ever being billed, so collisions are absorbed here.
async function createNumbered(fields, attempts = 5) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await Invoice.create({ ...fields, number: await nextInvoiceNumber() });
    } catch (err) {
      const isDuplicateNumber = err?.code === 11000 && err?.keyPattern?.number;
      if (!isDuplicateNumber || i === attempts - 1) throw err;
      // Loop: nextInvoiceNumber has already advanced the counter past the clash.
    }
  }
  throw new Error('Could not allocate an invoice number.');
}

// Net days a family gets to pay. Short enough to chase, long enough to be fair.
const DUE_DAYS = 14;

// Raise a bill and tell the family about it. Everything that invoices a family —
// a class seat, a make-up session, materials, a deposit — comes through here, so
// numbering, the fee snapshot and the notification cannot drift apart.
//
// Returns null for a zero total: a $0 invoice is noise, and Stripe would reject
// the charge anyway.
export async function createInvoice({
  userId,
  studentName = '',
  items,
  onlineFeeCents = null,
  dueInDays = DUE_DAYS,
  summary = '',
  enrollmentId = null,
  classId = null,
  quarter = '',
  creditId = null,
  issuedBy = '',
  notes = '',
}) {
  const lines = (items || [])
    .map((it) => ({
      description: String(it.description || '').trim(),
      detail: String(it.detail || '').trim(),
      amountCents: Math.round(Number(it.amountCents) || 0),
      kind: it.kind || 'other',
    }))
    // Discounts are the one line allowed below zero — everything else at zero
    // or less is a typo, not a price.
    .filter((it) => it.description && (it.amountCents > 0 || (it.kind === 'discount' && it.amountCents < 0)));

  const subtotalCents = lines.reduce((sum, it) => sum + it.amountCents, 0);
  if (subtotalCents <= 0) return null;

  const invoice = await createNumbered({
    userId,
    studentName,
    items: lines,
    subtotalCents,
    // Snapshot the fee so this bill keeps asking for the same amount however the
    // catalog is repriced later.
    onlineFeeCents: convenienceFeeFor(subtotalCents, onlineFeeCents),
    status: 'open',
    dueAt: new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000),
    enrollmentId,
    classId,
    quarter,
    creditId,
    issuedBy,
    notes,
  });

  // Best-effort: a mail outage must not undo a bill the office just raised, and
  // the invoice is visible in the portal either way.
  try {
    await notifyInvoiceIssued(invoice, summary || lines[0].description);
  } catch (err) {
    console.error('Invoice email failed for', invoice.number, err?.message || err);
  }

  return invoice;
}

// ── Quarterly discounts ────────────────────────────────────────────
// The handbook's two standing discounts, applied automatically when a bill is
// raised. Both are $100, both at most ONCE per family per quarter, and 1:1 /
// semi-private session assignments count as classes (owner's rule):
//   multi-class — the same student's second class of the quarter
//   sibling     — a second sibling joins the quarter
// "Already granted" is read off existing non-void invoices, so re-raising a
// bill can never stack a discount twice.
const DISCOUNT_CENTS = 10000;
const MULTI_CLASS_LABEL = 'Multi-class discount';
const SIBLING_LABEL = 'Sibling discount';

// `baseCents` is the bill's positive line total: a discount that would drag the
// bill below Stripe's floor is SKIPPED (not clamped), staying available for the
// family's next bill instead of burning itself on a $50 pack. `excludeEnrollmentId`
// keeps the enrollment currently being billed from counting as its own second
// class. Once-per-quarter is read-before-write — two bills raised in the same
// instant could both grant a label; a one-desk office makes that acceptable.
export async function quarterlyDiscountLines({ userId, studentName, quarter, baseCents = Infinity, excludeEnrollmentId = null }) {
  if (!quarter || !studentName) return [];

  const [enrollments, assignments, discounted] = await Promise.all([
    Enrollment.find({
      userId,
      quarter,
      paymentStatus: { $ne: 'refunded' },
      ...(excludeEnrollmentId ? { _id: { $ne: excludeEnrollmentId } } : {}),
    })
      .select('studentName')
      .lean(),
    Invoice.find({ userId, quarter, creditId: { $ne: null }, status: { $ne: 'void' } })
      .select('studentName')
      .lean(),
    Invoice.find({ userId, quarter, status: { $ne: 'void' }, 'items.kind': 'discount' })
      .select('items')
      .lean(),
  ]);

  const given = new Set(
    discounted.flatMap((inv) => inv.items.filter((it) => it.kind === 'discount').map((it) => it.description)),
  );
  const existing = [...enrollments, ...assignments].map((d) => d.studentName).filter(Boolean);

  const lines = [];
  let room = baseCents - STRIPE_MIN_CENTS; // what can be discounted away and leave a payable bill
  const offer = (description, detail) => {
    if (room < DISCOUNT_CENTS) return;
    lines.push({ description, detail, amountCents: -DISCOUNT_CENTS, kind: 'discount' });
    room -= DISCOUNT_CENTS;
  };
  if (!given.has(MULTI_CLASS_LABEL) && existing.some((n) => n === studentName)) {
    offer(MULTI_CLASS_LABEL, `${studentName}'s second class this quarter`);
  }
  if (!given.has(SIBLING_LABEL) && existing.some((n) => n && n !== studentName)) {
    offer(SIBLING_LABEL, 'Two siblings enrolled this quarter');
  }
  return lines;
}

// ── Assigned session packs: the pending credit's lifecycle ─────────
// Money in → sessions on. The pipeline-update flips pending off and copies
// totalSessions into remainingSessions in one atomic write, so a webhook
// redelivery (or mark-paid racing the webhook) can never top a balance back up.
export async function activateInvoiceCredit(invoice) {
  if (!invoice?.creditId) return null;
  return SessionCredit.findOneAndUpdate(
    { _id: invoice.creditId, pending: true },
    [{ $set: { pending: false, remainingSessions: '$totalSessions' } }],
    { new: true },
  );
}

// A voided assignment takes its unfulfilled promise with it. Only a pending
// credit can be deleted — once activated, the sessions belong to the family.
export async function releaseInvoiceCredit(invoice) {
  if (!invoice?.creditId) return { deletedCount: 0 };
  return SessionCredit.deleteOne({ _id: invoice.creditId, pending: true });
}

// Build the bill for one class seat.
export async function createClassInvoice({ user, enrollment, cls, issuedBy = '', notes = '' }) {
  // Materials are their own line when the class charges for them, because that
  // is how the tuition sheet quotes them. Folded into the tuition figure, a
  // family comparing the bill to the sheet finds a number that matches neither.
  const materialsCents = Math.round(Number(cls?.materialsFee || 0) * 100);
  const discounts = await quarterlyDiscountLines({
    userId: user._id ?? user,
    studentName: enrollment.studentName,
    quarter: cls.quarter || '',
    baseCents: Math.round(Number(cls?.price || 0) * 100) + materialsCents,
    // This seat's own enrollment row already exists — it must not count as the
    // student's "second class".
    excludeEnrollmentId: enrollment._id ?? null,
  });
  return createInvoice({
    userId: user._id ?? user,
    studentName: enrollment.studentName,
    items: [
      {
        description: `${cls.name} — tuition`,
        detail: [cls.schedule, enrollment.dayChoice].filter(Boolean).join(' · '),
        amountCents: Math.round(Number(cls?.price || 0) * 100),
        kind: 'tuition',
      },
      ...(materialsCents > 0
        ? [
            {
              description: `${cls.name} — books & materials`,
              detail: '',
              amountCents: materialsCents,
              kind: 'other',
            },
          ]
        : []),
      ...discounts,
    ],
    onlineFeeCents: cls?.onlineFeeCents ?? null,
    summary: [cls.name, cls.schedule].filter(Boolean).join(' · '),
    enrollmentId: enrollment._id,
    classId: cls._id,
    quarter: cls.quarter || '',
    issuedBy,
    notes,
  });
}

async function notifyInvoiceIssued(invoice, summary) {
  const user = await User.findById(invoice.userId).select('email firstName lastName name');
  if (!user?.email) return;
  const parentName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || 'there';
  await sendInvoiceIssued({
    to: user.email,
    parentName,
    studentName: invoice.studentName,
    invoiceNumber: invoice.number,
    summary,
    items: invoice.items,
    cardTotalCents: quoteFor(invoice.subtotalCents, 'card', invoice.onlineFeeCents).totalCents,
    subtotalCents: invoice.subtotalCents,
    dueAt: invoice.dueAt,
    siteUrl: process.env.SITE_URL || 'https://www.dotorischool.org',
  });
}

// What the family owes right now for a given method, plus everything the UI
// needs to explain it. Kept here so the portal, the API and the emails all
// derive the same numbers from the same place.
export function invoiceTotals(invoice, method) {
  const q = quoteFor(invoice.subtotalCents, method, invoice.onlineFeeCents);
  return {
    subtotalCents: q.subtotalCents,
    adjustmentCents: q.adjustmentCents,
    adjustmentLabel: q.adjustmentLabel,
    totalCents: q.totalCents,
  };
}

// Stripe's minimum charge. Below this the intent is rejected, so the UI must
// offer an alternative rather than a dead pay button.
export const STRIPE_MIN_CENTS = 50;

export function isPayable(invoice) {
  return (
    invoice &&
    invoice.status === 'open' &&
    invoice.subtotalCents >= STRIPE_MIN_CENTS
  );
}

// Shape an invoice for the client. Never leaks Mongo ids beyond the one the
// portal routes on, and pre-computes both quotes so the picker is instant.
export function serializeInvoice(inv) {
  return {
    id: String(inv._id),
    number: inv.number,
    studentName: inv.studentName,
    items: (inv.items || []).map((i) => ({
      description: i.description,
      detail: i.detail,
      amountCents: i.amountCents,
      kind: i.kind,
    })),
    subtotalCents: inv.subtotalCents,
    status: inv.status,
    // The seat this bill was raised for, so the portal can tell that a paid
    // invoice and the enrollment row beside it are one and the same payment.
    enrollmentId: inv.enrollmentId ? String(inv.enrollmentId) : null,
    dueAt: inv.dueAt,
    issuedAt: inv.issuedAt,
    paidAt: inv.paidAt,
    paymentMethod: inv.paymentMethod,
    adjustmentCents: inv.adjustmentCents,
    adjustmentLabel: inv.adjustmentLabel,
    totalPaidCents: inv.totalPaidCents,
    lastPaymentError: inv.lastPaymentError || '',
    onlineFeeCents: inv.onlineFeeCents,
    payments: (inv.payments || []).map((p) => ({
      at: p.at,
      amountCents: p.amountCents,
    })),
    quotes: {
      card: quoteFor(inv.subtotalCents, 'card', inv.onlineFeeCents),
      ach: quoteFor(inv.subtotalCents, 'ach', inv.onlineFeeCents),
    },
  };
}
