import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor } from '@/lib/tutor-helpers';
import { canEditFeedback } from '@/lib/feedback-helpers';
import { sendFeedbackReplyToFamily } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// POST /api/tutor/feedback/:id/replies, body: { text }: the note's instructor
// (or an admin) answers the family in the note's thread. The family gets an
// email nudge; the text itself stays in the portal.
export async function POST(request, { params }) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  const { id } = await params;

  const body = (await request.json().catch(() => null)) || {};
  const text = String(body.text || '').trim();
  if (!text) return Response.json({ error: 'Write a reply first.' }, { status: 400 });
  if (text.length > 4000) return Response.json({ error: 'Replies are limited to 4000 characters.' }, { status: 400 });

  await dbConnect();
  let fb;
  try {
    fb = await Feedback.findById(id);
  } catch {
    fb = null;
  }
  if (!fb) return Response.json({ error: 'Feedback not found.' }, { status: 404 });
  if (!canEditFeedback(fb, user, tutor)) {
    return Response.json({ error: 'Only the tutor who wrote this note (or an admin) can answer it.' }, { status: 403 });
  }

  const authorName =
    tutor?.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || 'Dotori School';
  fb.replies.push({ from: 'tutor', authorId: user._id, authorName, text });
  await fb.save();
  const reply = fb.replies[fb.replies.length - 1];

  let emailed = false;
  try {
    const family = await User.findById(fb.userId).select('email firstName name').lean();
    if (family?.email) {
      await sendFeedbackReplyToFamily({
        to: family.email,
        parentName: family.firstName || family.name || '',
        tutorName: authorName,
        studentName: fb.studentName,
        siteUrl: process.env.SITE_URL || 'https://www.dotorischool.org',
      });
      emailed = true;
    }
  } catch (err) {
    console.error('Feedback answer notification failed:', err);
  }

  return Response.json({ ok: true, emailed, reply });
}
