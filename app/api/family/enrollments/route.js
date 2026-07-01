import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import Class from '@/lib/models/Class'; // registers the Class model for populate()
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/family/enrollments
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await dbConnect();
    void Class; // ensure model is registered before populate
    const enrollments = await Enrollment.find({ userId: user._id })
      .populate('classId')
      .sort({ enrolledAt: -1 });
    return Response.json({ enrollments });
  } catch (err) {
    console.error('Enrollments fetch error:', err);
    return Response.json({ error: 'Failed to fetch enrollments.' }, { status: 500 });
  }
}
