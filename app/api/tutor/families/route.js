import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { getTutorOrAdmin, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tutor/families: list families so a tutor can grant them sessions.
export async function GET() {
  if (!(await getTutorOrAdmin())) return unauthorized();
  await dbConnect();
  const families = await User.find({ role: 'family' })
    .select('firstName lastName email name')
    .sort({ firstName: 1, name: 1 })
    .limit(1000);
  return Response.json({ families });
}
