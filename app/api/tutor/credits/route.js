import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import User from '@/lib/models/User'; // registers model for populate()
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tutor/credits: session grants scoped to this tutor.
export async function GET() {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();
  void User;

  const credits = await SessionCredit.find({ tutorId: tutor._id })
    .populate('userId', 'firstName lastName email name students')
    .sort({ createdAt: -1 })
    .limit(200);
  return Response.json({ credits });
}

// POST /api/tutor/credits: grant N sessions to a family, scoped to this tutor.
export async function POST(request) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  try {
    const { userId, sessions, note } = (await request.json()) || {};
    const n = parseInt(sessions);
    if (!userId || !n || n < 1) {
      return Response.json({ error: 'A family and a positive session count are required.' }, { status: 400 });
    }
    await dbConnect();
    const credit = await SessionCredit.create({
      userId,
      tutorId: tutor._id,
      totalSessions: n,
      remainingSessions: n,
      note: note || '',
      grantedBy: tutor.name,
    });
    return Response.json({ ok: true, credit });
  } catch (err) {
    console.error('Tutor grant credit error:', err);
    return Response.json({ error: 'Failed to add sessions.' }, { status: 500 });
  }
}
