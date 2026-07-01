import dbConnect from '@/lib/db';
import Report from '@/lib/models/Report';
import Class from '@/lib/models/Class'; // registers the Class model for populate()
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/family/reports
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await dbConnect();
    void Class; // ensure model is registered before populate
    const reports = await Report.find({ userId: user._id })
      .populate('classId', 'name')
      .sort({ uploadedAt: -1 });
    return Response.json({ reports });
  } catch (err) {
    console.error('Reports fetch error:', err);
    return Response.json({ error: 'Failed to fetch reports.' }, { status: 500 });
  }
}
