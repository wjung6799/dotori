import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import User from '@/lib/models/User';   // registers model for populate()
import Tutor from '@/lib/models/Tutor';  // registers model for populate()
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/credits?userId=...: credit grants (optionally for one family)
export async function GET(request) {
  if (!(await getAdminUser())) return forbidden();
  try {
    await dbConnect();
    void User;
    void Tutor;
    const { searchParams } = new URL(request.url);
    const filter = {};
    if (searchParams.get('userId')) filter.userId = searchParams.get('userId');
    const credits = await SessionCredit.find(filter)
      .populate('userId', 'firstName lastName email name')
      .populate('tutorId', 'name')
      .sort({ createdAt: -1 })
      .limit(200);
    return Response.json({ credits });
  } catch (err) {
    console.error('Admin credits fetch error:', err);
    return Response.json({ error: 'Failed to fetch credits.' }, { status: 500 });
  }
}

// POST /api/admin/credits: grant N sessions to a family (after offline payment)
export async function POST(request) {
  const admin = await getAdminUser();
  if (!admin) return forbidden();
  try {
    const body = (await request.json()) || {};
    const { userId, tutorId, sessions, note } = body;
    const n = parseInt(sessions);
    if (!userId || !n || n < 1) {
      return Response.json({ error: 'userId and a positive session count are required.' }, { status: 400 });
    }
    await dbConnect();
    const credit = await SessionCredit.create({
      userId,
      tutorId: tutorId || null,
      totalSessions: n,
      remainingSessions: n,
      note: note || '',
      grantedBy: admin.firstName || admin.name || admin.email || 'admin',
    });
    return Response.json({ ok: true, credit });
  } catch (err) {
    console.error('Grant credit error:', err);
    return Response.json({ error: 'Failed to add sessions.' }, { status: 500 });
  }
}
