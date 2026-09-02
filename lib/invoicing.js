import Counter from '@/lib/models/Counter';
import Invoice from '@/lib/models/Invoice';
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
    .filter((it) => it.description && it.amountCents > 0);

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

// Build the bill for one class seat.
export async function createClassInvoice({ user, enrollment, cls, issuedBy = '', notes = '' }) {
  // Materials are their own line when the class charges for them, because that
  // is how the tuition sheet quotes them. Folded into the tuition figure, a
  // family comparing the bill to the sheet finds a number that matches neither.
  const materialsCents = Math.round(Number(cls?.materialsFee || 0) * 100);
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
