import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import Tutor from '@/lib/models/Tutor';
import User from '@/lib/models/User';
import Class from '@/lib/models/Class';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';
import { sendFeedbackReplyToTutor, FEEDBACK_REPLY_FALLBACK } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// POST /api/feedback/:id/replies, body: { text }: the family the note was
// written for answers it. The note's instructor is emailed the reply; a note
// with no linked instructor login goes to the school's fallback inbox.
export async function POST(request, { params }) {
  const user = await getCurrentUser();
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
  // Only the family the note is addressed to; a 404 for anyone else so ids
  // can't be probed.
  if (!fb || String(fb.userId) !== String(user._id)) {
    return Response.json({ error: 'Feedback not found.' }, { status: 404 });
  }

  const parentName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email;
  fb.replies.push({ from: 'family', authorId: user._id, authorName: parentName, text });
  await fb.save();
  const reply = fb.replies[fb.replies.length - 1];

  let emailed = false;
  try {
    const tutor = fb.tutorId ? await Tutor.findById(fb.tutorId).select('name userId').lean() : null;
    const login = tutor?.userId ? await User.findById(tutor.userId).select('email').lean() : null;
    const to = login?.email || FEEDBACK_REPLY_FALLBACK;
    const cls = fb.classId ? await Class.findById(fb.classId).select('name').lean() : null;
    if (to) {
      await sendFeedbackReplyToTutor({
        to,
        tutorName: tutor?.name || fb.tutorName,
        parentName,
        studentName: fb.studentName,
        className: cls?.name || '',
        text,
        siteUrl: process.env.SITE_URL || 'https://www.dotorischool.org',
      });
      emailed = true;
    }
  } catch (err) {
    console.error('Feedback reply notification failed:', err);
  }

  return Response.json({ ok: true, emailed, reply });
}
