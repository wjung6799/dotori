import dbConnect from '@/lib/db';
import EnrollmentSurvey from '@/lib/models/EnrollmentSurvey';
import { getAdminUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/surveys: every submitted enrollment survey, newest first.
export async function GET() {
  if (!(await getAdminUser())) return unauthorized();
  await dbConnect();
  const surveys = await EnrollmentSurvey.find({})
    .populate('userId', 'firstName lastName email name students')
    .sort({ createdAt: -1 })
    .limit(500);
  return Response.json({ surveys });
}
