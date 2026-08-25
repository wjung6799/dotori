import Counter from '@/lib/models/Counter';
import Invoice from '@/lib/models/Invoice';
import User from '@/lib/models/User';
import { quoteFor } from '@/lib/pricing';
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

// Net days a family gets to pay. Short enough to chase, long enough to be fair.
const DUE_DAYS = 14;

// Build the bill for one class seat. Returns null when the class has no price —
// a $0 invoice is noise, and Stripe would reject the charge anyway, so those
// enrollments simply carry no invoice until the office prices the class.
export async function createClassInvoice({ user, enrollment, cls, issuedBy = '', notes = '' }) {
  const amountCents = Math.round(Number(cls?.price || 0) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

  const number = await nextInvoiceNumber();
  const dueAt = new Date(Date.now() + DUE_DAYS * 24 * 60 * 60 * 1000);

  const invoice = await Invoice.create({
    number,
    userId: user._id ?? user,
    studentName: enrollment.studentName,
    items: [
      {
        description: `${cls.name} — tuition`,
        detail: [cls.schedule, enrollment.dayChoice].filter(Boolean).join(' · '),
        amountCents,
        kind: 'tuition',
      },
    ],
    subtotalCents: amountCents,
    status: 'open',
    dueAt,
    enrollmentId: enrollment._id,
    classId: cls._id,
    quarter: cls.quarter || '',
    issuedBy,
    notes,
  });

  // Tell the family. Best-effort: a mail outage must not undo a placement the
  // office just made, and the invoice is visible in the portal either way.
  try {
    await notifyInvoiceIssued(invoice, cls);
  } catch (err) {
    console.error('Invoice email failed for', invoice.number, err?.message || err);
  }

  return invoice;
}

async function notifyInvoiceIssued(invoice, cls) {
  const user = await User.findById(invoice.userId).select('email firstName lastName name');
  if (!user?.email) return;
  const parentName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || 'there';
  await sendInvoiceIssued({
    to: user.email,
    parentName,
    studentName: invoice.studentName,
    invoiceNumber: invoice.number,
    className: cls?.name || 'a class',
    schedule: cls?.schedule || '',
    cardTotalCents: quoteFor(invoice.subtotalCents, 'card').totalCents,
    bankTotalCents: quoteFor(invoice.subtotalCents, 'ach').totalCents,
    dueAt: invoice.dueAt,
    siteUrl: process.env.SITE_URL || 'https://www.dotorischool.org',
  });
}

// What the family owes right now for a given method, plus everything the UI
// needs to explain it. Kept here so the portal, the API and the emails all
// derive the same numbers from the same place.
export function invoiceTotals(invoice, method) {
  const q = quoteFor(invoice.subtotalCents, method);
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
    quotes: {
      card: quoteFor(inv.subtotalCents, 'card'),
      ach: quoteFor(inv.subtotalCents, 'ach'),
    },
  };
}
