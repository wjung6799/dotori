import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import SessionCredit from '@/lib/models/SessionCredit';
import Order from '@/lib/models/Order';
import Class from '@/lib/models/Class'; // registers the model for populate()
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/family/billing: one combined payment history for the portal —
// class enrollments, purchased credit packs, and shop orders, newest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  await dbConnect();
  void Class;

  const [enrollments, credits, orders] = await Promise.all([
    Enrollment.find({ userId: user._id }).populate('classId', 'name schedule').sort({ enrolledAt: -1 }).lean(),
    // Only card purchases are billing events; offline Zelle grants show on the
    // credits page as grants, not as payments we took.
    SessionCredit.find({ userId: user._id, stripePaymentIntentId: { $ne: null } })
      .sort({ createdAt: -1 })
      .lean(),
    // Shop orders are guest-style: they carry an email, not a userId. Match on
    // the family's email so their store purchases land in the same history.
    user.email
      ? Order.find({ email: user.email.toLowerCase() }).sort({ createdAt: -1 }).limit(50).lean()
      : Promise.resolve([]),
  ]);

  const items = [];

  for (const e of enrollments) {
    items.push({
      id: 'enr-' + String(e._id),
      kind: 'Class enrollment',
      description: `${e.classId?.name || 'Class'}${e.studentName ? ` — ${e.studentName}` : ''}`,
      detail: e.classId?.schedule || '',
      amountCents: Math.round((e.amountPaid || 0) * 100),
      status: e.paymentStatus,
      at: e.paidAt || e.enrolledAt,
    });
  }

  for (const c of credits) {
    items.push({
      id: 'cr-' + String(c._id),
      kind: 'Session credits',
      description: c.note || `${c.totalSessions} sessions`,
      detail: `${c.remainingSessions} of ${c.totalSessions} remaining`,
      amountCents: c.amountPaidCents || 0,
      status: 'paid',
      at: c.createdAt,
    });
  }

  for (const o of orders || []) {
    items.push({
      id: 'ord-' + String(o._id),
      kind: 'Store order',
      description: (o.items || []).map((i) => i.name).filter(Boolean).join(', ') || 'Order',
      detail: o.fulfillmentStatus || '',
      amountCents: Math.round((o.total || 0) * 100),
      status: o.paymentStatus || 'pending',
      at: o.paidAt || o.createdAt,
    });
  }

  items.sort((a, b) => new Date(b.at) - new Date(a.at));

  const paidCents = items
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.amountCents, 0);

  return Response.json({ items, paidCents });
}
