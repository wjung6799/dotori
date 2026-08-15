import dbConnect from '@/lib/db';
import Review from '@/lib/models/Review';
import { getAdminUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/reviews: every review, pending first, then newest.
export async function GET() {
  if (!(await getAdminUser())) return unauthorized();
  await dbConnect();
  const reviews = await Review.find({}).sort({ approved: 1, createdAt: -1 }).limit(1000);
  return Response.json({ reviews });
}
