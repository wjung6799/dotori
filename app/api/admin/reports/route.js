import dbConnect from '@/lib/db';
import Report from '@/lib/models/Report';
import User from '@/lib/models/User';   // registers model for populate()
import Class from '@/lib/models/Class'; // registers model for populate()
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports
export async function GET() {
  if (!(await getAdminUser())) return forbidden();

  try {
    await dbConnect();
    void User;
    void Class;
    const reports = await Report.find()
      .populate('userId', 'firstName lastName email name students')
      .populate('classId', 'name')
      .sort({ uploadedAt: -1 });
    return Response.json({ reports });
  } catch (err) {
    console.error('Admin reports fetch error:', err);
    return Response.json({ error: 'Failed to fetch reports.' }, { status: 500 });
  }
}
