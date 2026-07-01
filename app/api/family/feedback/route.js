import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/family/feedback — feedback written for the signed-in family.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  await dbConnect();
  const feedback = await Feedback.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(200);
  return Response.json({ feedback });
}
