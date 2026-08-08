import dbConnect from '@/lib/db';
import Waitlist from '@/lib/models/Waitlist';
import { getAdminUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/waitlist: all waitlist entries, oldest first (queue order).
export async function GET() {
  if (!(await getAdminUser())) return unauthorized();
  await dbConnect();
  const entries = await Waitlist.find({}).sort({ createdAt: 1 }).limit(1000);
  return Response.json({ entries });
}
