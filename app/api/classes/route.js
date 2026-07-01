import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import Enrollment from '@/lib/models/Enrollment';

export const dynamic = 'force-dynamic';

// GET /api/classes — list active classes, optionally filter by quarter/category.
export async function GET(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);

    const filter = { active: true };
    if (searchParams.get('quarter')) filter.quarter = searchParams.get('quarter');
    if (searchParams.get('category')) filter.category = searchParams.get('category');

    const classes = await Class.find(filter).sort({ createdAt: 1 });

    const withCounts = await Promise.all(
      classes.map(async (c) => {
        const count = await Enrollment.countDocuments({
          classId: c._id,
          paymentStatus: { $ne: 'refunded' },
        });
        return { ...c.toObject(), enrolledCount: count };
      }),
    );

    // Group by category order: reading → writing → korean → summer → 1on1
    const catOrder = { reading: 0, writing: 1, korean: 2, summer: 3, '1on1': 4 };
    withCounts.sort((a, b) => (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9));

    return Response.json({ classes: withCounts });
  } catch (err) {
    console.error('Classes fetch error:', err);
    return Response.json({ error: 'Failed to fetch classes.' }, { status: 500 });
  }
}
