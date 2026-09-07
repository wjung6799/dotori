import mongoose from 'mongoose';
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
  enrollmentIds = [],
  issuedBy = '',
  notes = '',
  // Office-created invoices no longer email on creation — the family gets one
  // accurate email when the office presses Send (so siblings merged onto one
  // bill are announced once, not per seat). Pass notify:true to email now.
  notify = false,
}) {
  const lines = (items || [])
    .map((it) => ({
      description: String(it.description || '').trim(),
      detail: String(it.detail || '').trim(),
      amountCents: Math.round(Number(it.amountCents) || 0),
      studentName: it.studentName || '',
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
    enrollmentIds,
    classId,
    quarter,
    creditId,
    issuedBy,
    notes,
  });

  // Best-effort: a mail outage must not undo a bill the office just raised, and
  // the invoice is visible in the portal either way.
  if (notify) {
    try {
      await sendInvoiceEmail(invoice, summary || lines[0].description);
    } catch (err) {
      console.error('Invoice email failed for', invoice.number, err?.message || err);
    }
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

// The two standing quarterly discounts, computed from the family's REAL state
// this quarter: $100 multi-class (any one student in 2+ classes) and $100
// sibling (2+ distinct students). Each is granted at most once per family per
// quarter — "given" is read off the family's other non-void invoices, so it
// never stacks across separate bills, and `excludeInvoiceId` lets an invoice
// being recomputed ignore its own current discount lines. A discount that would
// drag the bill below Stripe's floor is skipped (it stays available for the
// next bill). Assigned session packs count as classes (owner's rule).
//
// Counts come from what is actually in the database — enrollments already
// created, packs already assigned — so callers must create the enrollment
// BEFORE asking (the single, bundle and merge paths all do).
export async function quarterlyDiscountLines({ userId, quarter, baseCents = Infinity, excludeInvoiceId = null }) {
  if (!quarter) return [];

  const [enrollments, assignments, discounted] = await Promise.all([
    Enrollment.find({ userId, quarter, paymentStatus: { $ne: 'refunded' } }).select('studentName').lean(),
    Invoice.find({ userId, quarter, creditId: { $ne: null }, status: { $ne: 'void' } }).select('studentName').lean(),
    Invoice.find({
      userId,
      quarter,
      status: { $ne: 'void' },
      'items.kind': 'discount',
      ...(excludeInvoiceId ? { _id: { $ne: excludeInvoiceId } } : {}),
    }).select('items').lean(),
  ]);

  const given = new Set(
    discounted.flatMap((inv) => inv.items.filter((it) => it.kind === 'discount').map((it) => it.description)),
  );
  // A bill from before multi-class became per-student wrote the bare label
  // 'Multi-class discount' with no name. Treat its presence as "one multi
  // already given" so the deploy boundary cannot double-grant $100.
  const legacyMulti = given.has(MULTI_CLASS_LABEL);
  let legacyMultiSpent = false;

  // Per-student class counts across everything the family holds this quarter.
  const counts = new Map();
  for (const d of [...enrollments, ...assignments]) {
    if (d.studentName) counts.set(d.studentName, (counts.get(d.studentName) || 0) + 1);
  }

  const lines = [];
  let room = baseCents - STRIPE_MIN_CENTS;
  const offer = (description, detail) => {
    if (room < DISCOUNT_CENTS) return;
    lines.push({ description, detail, amountCents: -DISCOUNT_CENTS, kind: 'discount' });
    room -= DISCOUNT_CENTS;
  };

  // Multi-class is PER STUDENT: each student who takes two or more classes this
  // quarter earns their own $100 (owner's rule — "멀티는 학생 한명당"). The
  // student's name is on the line so a second class for a DIFFERENT sibling
  // grants its own, and a re-raise never doubles one already given.
  for (const [student, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count < 2) continue;
    const description = `${MULTI_CLASS_LABEL} · ${student}`;
    if (given.has(description)) continue;
    // The one bare legacy multi covers the first eligible student, so it is not
    // granted twice across the format change.
    if (legacyMulti && !legacyMultiSpent) { legacyMultiSpent = true; continue; }
    offer(description, `${student} takes ${count} classes this quarter`);
  }
  // Sibling is PER FAMILY: one $100 whether two children enrol or more
  // ("시블링은 두명이고 세명이고 같음").
  if (!given.has(SIBLING_LABEL) && counts.size >= 2) {
    offer(SIBLING_LABEL, 'Two or more siblings enrolled this quarter');
  }
  return lines;
}

// The one OPEN, unpaid enrollment invoice a family has this quarter — the bill a
// new seat should JOIN so siblings land on a single invoice however the office
// enrolls them (one at a time or all at once). Assignment invoices (creditId)
// and anything already paid/clearing/void are never touched.
export async function findOpenEnrollmentInvoice({ userId, quarter }) {
  return Invoice.findOne({
    userId,
    quarter,
    status: 'open',
    creditId: null,
    enrollmentId: { $ne: null },
    // A card payment stays 'open' with an intent set until the webhook lands —
    // never grow a bill someone is already paying, or the new seat rides free.
    $or: [{ stripePaymentIntentId: null }, { stripePaymentIntentId: '' }],
  }).sort({ issuedAt: 1 });
}

// Add one seat's tuition line to an existing open invoice and re-decide the
// quarterly discounts across everything now on it. Mutates and saves the
// invoice. The family has paid nothing yet (status 'open'), so changing the
// amount is fair game — that is the whole point of merging.
export async function addSeatToInvoice({ invoice, cls, studentName, tuitionCents, priceOption, enrollmentId }) {
  invoice.enrollmentIds = invoice.enrollmentIds?.length
    ? [...invoice.enrollmentIds, enrollmentId]
    : [invoice.enrollmentId, enrollmentId].filter(Boolean);

  const kept = invoice.items.filter((it) => it.kind !== 'discount');
  kept.push({
    description: `${cls.name} — tuition · ${studentName}`,
    detail: [cls.schedule, priceOption ? priceOption.label : ''].filter(Boolean).join(' · '),
    amountCents: tuitionCents,
    studentName,
    kind: 'tuition',
  });

  const base = kept.reduce((sum, it) => sum + it.amountCents, 0);
  const discounts = await quarterlyDiscountLines({
    userId: invoice.userId,
    quarter: invoice.quarter,
    baseCents: base,
    excludeInvoiceId: invoice._id,
  });

  invoice.items = [...kept, ...discounts];
  invoice.subtotalCents = invoice.items.reduce((sum, it) => sum + it.amountCents, 0);
  // Fee snapshot tracks the merged basket (a no-op under the percentage modes).
  invoice.onlineFeeCents = convenienceFeeFor(invoice.subtotalCents, null);
  // The names on the bill come from the ENROLLMENTS, never parsed back out of a
  // description — a legacy line without a ' · student' suffix would otherwise
  // corrupt the header.
  const enrs = await Enrollment.find({ _id: { $in: invoice.enrollmentIds } }).select('studentName').lean();
  const names = [...new Set(enrs.map((e) => e.studentName).filter(Boolean))];
  if (names.length) invoice.studentName = names.join(', ');
  await invoice.save();
  return invoice;
}

// Remove one seat from a bill that may cover several, recompute, and re-decide
// the discounts. Returns { invoice, voided } — voided when that was the last
// seat, so the whole bill goes. Only touches an unpaid bill (the caller guards
// 'processing'); a paid bill's seats are settled and stay.
export async function removeSeatFromInvoice({ invoice, enrollmentId }) {
  const ids = (invoice.enrollmentIds?.length ? invoice.enrollmentIds : [invoice.enrollmentId].filter(Boolean))
    .map(String)
    .filter((id) => id !== String(enrollmentId));

  if (ids.length === 0) {
    invoice.status = 'void';
    invoice.voidedAt = new Date();
    await invoice.save();
    return { invoice, voided: true };
  }

  const remaining = ids.map((id) => new mongoose.Types.ObjectId(id));
  const enrs = await Enrollment.find({ _id: { $in: remaining } }).select('studentName classId').lean();
  const names = new Set(enrs.map((e) => e.studentName));

  // Keep only the tuition lines whose student is still enrolled. Lines carry a
  // studentName now; a legacy line without one is matched by its ' · <name>'
  // suffix, and anything unattributable is kept (better an extra line to review
  // than a silently dropped charge).
  const kept = invoice.items
    .filter((it) => it.kind !== 'discount')
    .filter((it) => {
      if (it.kind !== 'tuition') return true;
      const who = it.studentName || (it.description.includes(' · ') ? it.description.split(' · ').pop() : null);
      return !who || names.has(who);
    });

  invoice.enrollmentId = remaining[0];
  invoice.enrollmentIds = remaining;
  const base = kept.reduce((sum, it) => sum + it.amountCents, 0);
  const discounts = await quarterlyDiscountLines({
    userId: invoice.userId,
    quarter: invoice.quarter,
    baseCents: base,
    excludeInvoiceId: invoice._id,
  });
  invoice.items = [...kept, ...discounts];
  invoice.subtotalCents = invoice.items.reduce((sum, it) => sum + it.amountCents, 0);
  invoice.onlineFeeCents = convenienceFeeFor(invoice.subtotalCents, null);
  invoice.studentName = [...names].join(', ');
  await invoice.save();
  return { invoice, voided: false };
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
// `priceOption` is one of the class's named pricing options ({label, price}),
// picked by the office at assignment time. Only the bill follows it.
export async function createClassInvoice({ user, enrollment, cls, priceOption = null, issuedBy = '', notes = '', notify = false }) {
  // Materials are their own line when the class charges for them, because that
  // is how the tuition sheet quotes them. Folded into the tuition figure, a
  // family comparing the bill to the sheet finds a number that matches neither.
  const materialsCents = Math.round(Number(cls?.materialsFee || 0) * 100);
  const tuitionCents = Math.round(Number(priceOption?.price ?? cls?.price ?? 0) * 100);
  const discounts = await quarterlyDiscountLines({
    userId: user._id ?? user,
    quarter: cls.quarter || '',
    baseCents: tuitionCents + materialsCents,
  });
  return createInvoice({
    notify,
    userId: user._id ?? user,
    studentName: enrollment.studentName,
    items: [
      {
        description: `${cls.name} — tuition · ${enrollment.studentName}`,
        detail: [cls.schedule, enrollment.dayChoice, priceOption ? priceOption.label : '']
          .filter(Boolean)
          .join(' · '),
        amountCents: tuitionCents,
        studentName: enrollment.studentName,
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

// Email the family this invoice AS IT STANDS. The office sends it by hand from
// the invoices console so a bill built up over several enrollments is announced
// once, accurately, rather than per seat.
export async function sendInvoiceEmail(invoice, summary = '') {
  const user = await User.findById(invoice.userId).select('email firstName lastName name');
  if (!user?.email) return false;
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
  return true;
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
    sentAt: inv.sentAt,
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
