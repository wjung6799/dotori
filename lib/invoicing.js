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

// Three months is the ceiling: past that a term is over before it is paid for.
export const MAX_INSTALLMENTS = 3;

// Divide integer cents into n parts that add back to exactly the total. The
// remainder goes on the FIRST payment, so the last one is never the odd cent and
// the family's total is identical to paying in full.
function splitCents(totalCents, n) {
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? remainder : 0));
}

// Same calendar day, n months on. Clamped so 31 Jan + 1 month lands on 28/29 Feb
// rather than skipping into March.
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

// Build the bill for one class seat. Returns null when the class has no price —
// a $0 invoice is noise, and Stripe would reject the charge anyway, so those
// enrollments simply carry no invoice until the office prices the class.
export async function createClassInvoice({ user, enrollment, cls, issuedBy = '', notes = '' }) {
  const amountCents = Math.round(Number(cls?.price || 0) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

  const dueAt = new Date(Date.now() + DUE_DAYS * 24 * 60 * 60 * 1000);

  const invoice = await createNumbered({
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
    // Snapshot the class's own fee (or the 3% suggestion when it has none) so
    // this bill keeps asking for the same amount however the catalog changes.
    onlineFeeCents: convenienceFeeFor(amountCents, cls?.onlineFeeCents),
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
    cardTotalCents: quoteFor(invoice.subtotalCents, 'card', invoice.onlineFeeCents).totalCents,
    bankTotalCents: quoteFor(invoice.subtotalCents, 'ach', invoice.onlineFeeCents).totalCents,
    dueAt: invoice.dueAt,
    siteUrl: process.env.SITE_URL || 'https://www.dotorischool.org',
  });
}

// Turn one open invoice into `count` monthly instalments. The original is voided
// rather than deleted so the trail of what was billed stays intact.
//
// Both the tuition and the online card fee are split, so three payments cost the
// family exactly what one would have — an instalment plan that quietly cost more
// would be a penalty for needing one.
export async function splitInvoiceIntoInstallments(invoice, count) {
  const n = Math.max(2, Math.min(MAX_INSTALLMENTS, Math.round(count)));

  const amounts = splitCents(invoice.subtotalCents, n);
  const fees = splitCents(convenienceFeeFor(invoice.subtotalCents, invoice.onlineFeeCents), n);
  const planId = String(invoice._id);
  const label = (i) => `Payment ${i + 1} of ${n}`;

  const created = [];
  for (let i = 0; i < n; i += 1) {
    // First payment keeps the original's due date; the rest fall a month apart.
    const dueAt = i === 0 ? invoice.dueAt || new Date() : addMonths(invoice.dueAt || new Date(), i);
    created.push(
      await createNumbered({
        userId: invoice.userId,
        studentName: invoice.studentName,
        items: (invoice.items || []).map((it) => ({
          description: `${it.description} — ${label(i)}`,
          detail: it.detail,
          amountCents: splitCents(it.amountCents, n)[i],
          kind: it.kind,
        })),
        subtotalCents: amounts[i],
        onlineFeeCents: fees[i],
        status: 'open',
        dueAt,
        enrollmentId: invoice.enrollmentId,
        classId: invoice.classId,
        quarter: invoice.quarter,
        planId,
        installmentNumber: i + 1,
        installmentCount: n,
        issuedBy: invoice.issuedBy,
        notes: `Instalment ${i + 1} of ${n} from ${invoice.number}`,
      }),
    );
  }

  invoice.status = 'void';
  invoice.voidedAt = new Date();
  invoice.notes = `Split into ${n} monthly payments`;
  await invoice.save();

  return created;
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
    // Without these the portal cannot tell an instalment from a standalone bill,
    // and would offer to split one that is already part of a plan.
    planId: inv.planId || null,
    installmentNumber: inv.installmentNumber || null,
    installmentCount: inv.installmentCount || null,
    quotes: {
      card: quoteFor(inv.subtotalCents, 'card', inv.onlineFeeCents),
      ach: quoteFor(inv.subtotalCents, 'ach', inv.onlineFeeCents),
    },
  };
}
