import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import Enrollment from '@/lib/models/Enrollment';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/classes — all classes (active + inactive) with enrollment counts
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
    const { name, category, quarter, schedule, description, price, capacity } = body || {};
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
      capacity: capacity || 20,
    });
    return Response.json({ ok: true, class: cls });
  } catch (err) {
    console.error('Class create error:', err);
    return Response.json({ error: 'Failed to create class.' }, { status: 500 });
  }
}
