import dbConnect from '@/lib/db';
import Invoice from '@/lib/models/Invoice';
import { serializeInvoice } from '@/lib/invoicing';
import { savingsHint, PAYMENT_ADJUSTMENT } from '@/lib/pricing';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/family/invoices: everything the signed-in family has been billed,
// unpaid first so the thing that needs doing is at the top.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  await dbConnect();
  const invoices = await Invoice.find({ userId: user._id }).sort({ issuedAt: -1 }).lean();

  const rank = { open: 0, processing: 1, paid: 2, void: 3 };
  invoices.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || new Date(b.issuedAt) - new Date(a.issuedAt));

  const serialized = invoices.map(serializeInvoice);
  const outstandingCents = serialized
    .filter((i) => i.status === 'open')
    .reduce((sum, i) => sum + i.subtotalCents, 0);

  return Response.json({
    invoices: serialized,
    outstandingCents,
    savingsHint: savingsHint(),
    adjustment: PAYMENT_ADJUSTMENT,
  });
}
