import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';
import { getMyTutor } from '@/lib/tutor-helpers';
import { unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tutor/feedback — recent feedback (for the tutor's review list).
export async function GET() {
  const { user } = await getMyTutor();
  if (!user) return unauthorized();
  await dbConnect();
  const feedback = await Feedback.find({}).sort({ createdAt: -1 }).limit(200);
  return Response.json({ feedback });
}

// POST /api/tutor/feedback — body: { userId, studentName, text }
export async function POST(request) {
  const { user: author, tutor } = await getMyTutor();
  if (!author) return unauthorized();

  try {
    const { userId, studentName, text } = (await request.json()) || {};
    if (!userId || !text || !text.trim()) {
      return Response.json({ error: 'A family and feedback text are required.' }, { status: 400 });
    }

    await dbConnect();
    const family = await User.findOne({ _id: userId, role: 'family' }).select('_id');
    if (!family) return Response.json({ error: 'Family not found.' }, { status: 404 });

    const tutorName =
      tutor?.name ||
      [author.firstName, author.lastName].filter(Boolean).join(' ') ||
      author.name ||
      'Dotori School';

    const feedback = await Feedback.create({
      userId: family._id,
      tutorId: tutor?._id || null,
      tutorName,
      studentName: (studentName || '').trim(),
      text: text.trim(),
    });
    return Response.json({ ok: true, feedback });
  } catch (err) {
    console.error('Create feedback error:', err);
    return Response.json({ error: 'Failed to save feedback.' }, { status: 500 });
  }
}
