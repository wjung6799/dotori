import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import User from '@/lib/models/User';   // registers model for populate()
import Class from '@/lib/models/Class'; // registers model for populate()
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/enrollments
export async function GET(request) {
  if (!(await getAdminUser())) return forbidden();

  try {
    await dbConnect();
    void User;
    void Class;
    const { searchParams } = new URL(request.url);
    const filter = {};
    if (searchParams.get('quarter')) filter.quarter = searchParams.get('quarter');
    if (searchParams.get('status')) filter.paymentStatus = searchParams.get('status');

    const enrollments = await Enrollment.find(filter)
      .populate('userId', 'firstName lastName email phone name')
      .populate('classId', 'name schedule price')
      .sort({ enrolledAt: -1 });
    return Response.json({ enrollments });
  } catch (err) {
    console.error('Admin enrollments fetch error:', err);
    return Response.json({ error: 'Failed to fetch enrollments.' }, { status: 500 });
  }
}
