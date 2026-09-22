import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';
import { getMyTutor } from '@/lib/tutor-helpers';
import { unauthorized } from '@/lib/auth-helpers';
import { canEditFeedback } from '@/lib/feedback-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tutor/feedback: recent feedback (for the tutor's review list). Each
// row carries `canEdit` so the page knows which notes to offer Edit/Delete on.
export async function GET() {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  await dbConnect();
  const rows = await Feedback.find({}).sort({ createdAt: -1 }).limit(200).lean();
  const feedback = rows.map((fb) => ({ ...fb, canEdit: canEditFeedback(fb, user, tutor) }));
  return Response.json({ feedback });
}

// POST /api/tutor/feedback, body: { userId, studentName, text }
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
    return Response.json({ ok: true, feedback: { ...feedback.toObject(), canEdit: true } });
  } catch (err) {
    console.error('Create feedback error:', err);
    return Response.json({ error: 'Failed to save feedback.' }, { status: 500 });
  }
}
