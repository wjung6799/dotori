import dbConnect from '@/lib/db';
import Invoice from '@/lib/models/Invoice';
import User from '@/lib/models/User';
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
