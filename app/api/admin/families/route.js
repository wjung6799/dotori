import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Enrollment from '@/lib/models/Enrollment';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/families
export async function GET() {
  if (!(await getAdminUser())) return forbidden();

  try {
    await dbConnect();
    const users = await User.find({ role: 'family' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });
    const withCounts = await Promise.all(
      users.map(async (u) => {
        const enrollmentCount = await Enrollment.countDocuments({ userId: u._id });
        return { ...u.toObject(), enrollmentCount };
      }),
    );
    return Response.json({ families: withCounts });
  } catch (err) {
    console.error('Families fetch error:', err);
    return Response.json({ error: 'Failed to fetch families.' }, { status: 500 });
  }
}
