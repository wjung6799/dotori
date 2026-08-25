import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import Enrollment from '@/lib/models/Enrollment';
import { defaultOnlineFeeCents } from '@/lib/pricing';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// '' / null / undefined → null (field not set); anything numeric → Number.
function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/admin/classes: all classes (active + inactive) with enrollment counts
export async function GET() {
  if (!(await getAdminUser())) return forbidden();

  try {
    await dbConnect();
    const classes = await Class.find().sort({ quarter: 1, name: 1 });
    const withCounts = await Promise.all(
      classes.map(async (c) => {
        const count = await Enrollment.countDocuments({
          classId: c._id,
          paymentStatus: { $ne: 'refunded' },
        });
        return { ...c.toObject(), enrolledCount: count };
      }),
    );
    return Response.json({ classes: withCounts });
  } catch (err) {
    console.error('Admin classes fetch error:', err);
    return Response.json({ error: 'Failed to fetch classes.' }, { status: 500 });
  }
}

// POST /api/admin/classes
export async function POST(request) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const body = await request.json();
    const { name, category, quarter, schedule, description, price, capacity, scheduleKey } = body || {};
    if (!name || !category || !quarter || price === undefined) {
      return Response.json(
        { error: 'Name, category, quarter, and price are required.' },
        { status: 400 },
      );
    }
    await dbConnect();
    const cls = await Class.create({
      name,
      category,
      quarter,
      schedule,
      description,
      price: Number(price),
      // Optional price fields: an early-bird figure and an upper bound for the
      // ranged 1:1 listings. Blank means "not set", which must stay null rather
      // than 0 — 0 would render as a real $0 price on the catalog.
      earlyBirdPrice: numOrNull(body?.earlyBirdPrice),
      priceMax: numOrNull(body?.priceMax),
      // Every class gets an online card fee the moment it is priced, so nobody
      // has to remember a second field. It is a fixed dollar figure derived once
      // from the tuition, and the admin can overwrite it.
      onlineFeeCents:
        body?.onlineFeeCents === undefined || body?.onlineFeeCents === '' || body?.onlineFeeCents === null
          ? defaultOnlineFeeCents(Math.round(Number(price) * 100))
          : Math.max(0, Math.round(Number(body.onlineFeeCents))),
      capacity: capacity || 20,
      scheduleKey: scheduleKey || '',
    });
    return Response.json({ ok: true, class: cls });
  } catch (err) {
    console.error('Class create error:', err);
    return Response.json({ error: 'Failed to create class.' }, { status: 500 });
  }
}
