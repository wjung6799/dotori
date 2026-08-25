import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Invoice from '@/lib/models/Invoice';
import User from '@/lib/models/User';
import { createInvoice } from '@/lib/invoicing';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/invoices?status=open
// Everything the school has billed, newest first, with the family attached so
// the office can chase without a second lookup.
export async function GET(request) {
  if (!(await getAdminUser())) return forbidden();

  await dbConnect();
  void User;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const filter = ['open', 'processing', 'paid', 'void'].includes(status) ? { status } : {};

  const invoices = await Invoice.find(filter)
    .populate('userId', 'firstName lastName name email phone')
    .sort({ issuedAt: -1 })
    .limit(500)
    .lean();

  const now = Date.now();

  // Totals describe the whole book, never just the rows below them: the three
  // stat cards sit above the filter and each names a different status, so
  // deriving them from the filtered page would zero two of them out the moment
  // the office picks a status — and the .limit(500) above would quietly
  // understate the third. Aggregate across every invoice instead.
  const [agg] = await Invoice.aggregate([
    {
      $group: {
        _id: null,
        outstandingCents: {
          $sum: {
            $cond: [{ $eq: ['$status', 'open'] }, { $ifNull: ['$subtotalCents', 0] }, 0],
          },
        },
        processingCents: {
          $sum: {
            $cond: [{ $eq: ['$status', 'processing'] }, { $ifNull: ['$subtotalCents', 0] }, 0],
          },
        },
        collectedCents: {
          $sum: {
            $cond: [{ $eq: ['$status', 'paid'] }, { $ifNull: ['$totalPaidCents', 0] }, 0],
          },
        },
      },
    },
  ]);

  return Response.json({
    invoices: invoices.map((i) => ({
      id: String(i._id),
      number: i.number,
      studentName: i.studentName,
      family:
        [i.userId?.firstName, i.userId?.lastName].filter(Boolean).join(' ') ||
        i.userId?.name ||
        i.userId?.email ||
        'Unknown family',
      email: i.userId?.email || '',
      items: i.items || [],
      subtotalCents: i.subtotalCents,
      status: i.status,
      // Overdue is derived, not stored — a stored flag would need a cron to stay
      // true and would be wrong the moment a due date is edited.
      overdue: i.status === 'open' && i.dueAt && new Date(i.dueAt).getTime() < now,
      dueAt: i.dueAt,
      issuedAt: i.issuedAt,
      paidAt: i.paidAt,
      paymentMethod: i.paymentMethod,
      adjustmentCents: i.adjustmentCents,
      totalPaidCents: i.totalPaidCents,
      lastPaymentError: i.lastPaymentError || '',
    })),
    totals: {
      outstandingCents: agg?.outstandingCents || 0,
      processingCents: agg?.processingCents || 0,
      collectedCents: agg?.collectedCents || 0,
    },
  });
}

// POST /api/admin/invoices: raise a bill by hand.
//
// Class seats invoice themselves, but plenty does not: a make-up session,
// materials, a deposit, a late fee, a term settled outside the catalog. Without
// this the office's only way to bill for those is to fake a class.
export async function POST(request) {
  const admin = await getAdminUser();
  if (!admin) return forbidden();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  await dbConnect();

  // Address the family by id or by email — the office thinks in email addresses.
  let family = null;
  if (body?.userId && mongoose.isValidObjectId(body.userId)) {
    family = await User.findById(body.userId).select('_id email firstName lastName name students');
  } else if (body?.email) {
    family = await User.findOne({ email: body.email.toString().trim().toLowerCase() })
      .select('_id email firstName lastName name students');
  }
  if (!family) {
    return Response.json({ error: 'No family found for that email.' }, { status: 404 });
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return Response.json({ error: 'Add at least one line item.' }, { status: 400 });
  }

  const dueInDays = Number.isFinite(Number(body?.dueInDays)) ? Math.max(0, Math.round(Number(body.dueInDays))) : 14;

  try {
    const invoice = await createInvoice({
      userId: family._id,
      studentName: (body?.studentName || '').toString().trim(),
      items: items.map((i) => ({
        description: i.description,
        detail: i.detail,
        // The form collects dollars because that is what a human types.
        amountCents: Math.round(Number(i.amount) * 100),
        kind: i.kind || 'other',
      })),
      onlineFeeCents:
        body?.onlineFee === undefined || body?.onlineFee === '' || body?.onlineFee === null
          ? null
          : Math.round(Number(body.onlineFee) * 100),
      dueInDays,
      summary: (body?.summary || '').toString().trim(),
      issuedBy: [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.name || admin.email,
      notes: (body?.notes || '').toString().trim().slice(0, 500),
    });

    if (!invoice) {
      return Response.json({ error: 'Every line came to $0 — nothing to bill.' }, { status: 400 });
    }

    return Response.json(
      {
        ok: true,
        invoice: {
          id: String(invoice._id),
          number: invoice.number,
          subtotalCents: invoice.subtotalCents,
          onlineFeeCents: invoice.onlineFeeCents,
        },
        emailedTo: family.email,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Ad-hoc invoice creation failed:', err);
    return Response.json({ error: 'Could not raise the invoice.' }, { status: 500 });
  }
}
