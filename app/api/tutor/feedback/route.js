import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';
import Class from '@/lib/models/Class';
import Enrollment from '@/lib/models/Enrollment';
import { classifyNote } from '@/lib/feedbackClassify';
import { sendFeedbackNotification } from '@/lib/mailer';
import { getMyTutor } from '@/lib/tutor-helpers';
import { unauthorized } from '@/lib/auth-helpers';
import { canEditFeedback } from '@/lib/feedback-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tutor/feedback[?all=1]: the caller's own notes (their tutor
// profile's tutorId). An admin may pass all=1 to see every instructor's notes;
// an admin with no tutor profile has nothing of their own, so they get all.
// Each row carries `canEdit` so the page knows which notes to offer Edit/Delete on.
export async function GET(request) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  await dbConnect();
  void Class; // registered for populate()
  const isAdmin = user.role === 'admin';
  const wantAll = new URL(request.url).searchParams.get('all') === '1';
  const showAll = isAdmin && (wantAll || !tutor);
  const filter = showAll ? {} : { tutorId: tutor?._id || null };
  const rows = await Feedback.find(filter).populate('classId', 'name').sort({ createdAt: -1 }).limit(2000).lean();
  const feedback = rows.map((fb) => ({
    ...fb,
    classId: fb.classId?._id || null,
    className: fb.classId?.name || '',
    canEdit: canEditFeedback(fb, user, tutor),
  }));
  return Response.json({ feedback, showAll, canSeeAll: isAdmin && Boolean(tutor) });
}

// POST /api/tutor/feedback, body: { userId, studentName, text, classId?, lessonDate? }
// The "one student" form. The family gets the same email nudge as a batch send.
export async function POST(request) {
  const { user: author, tutor } = await getMyTutor();
  if (!author) return unauthorized();

  try {
    const { userId, studentName, text, classId, lessonDate } = (await request.json()) || {};
    if (!userId || !text || !text.trim()) {
      return Response.json({ error: 'A family and feedback text are required.' }, { status: 400 });
    }

    await dbConnect();
    const family = await User.findOne({ _id: userId, role: 'family' }).select('_id email firstName name');
    if (!family) return Response.json({ error: 'Family not found.' }, { status: 404 });
    let cls = classId ? await Class.findById(classId).select('name').lean() : null;
    let name = (studentName || '').trim();
    let date = /^\d{4}-\d{2}-\d{2}$/.test(lessonDate || '') ? lessonDate : '';

    // Sent from the one-student form with no class picked: file it from the
    // header on its first line ("[Fall 2026 Sprout Book Club - Week 6]") and
    // the student's enrollments. Left unfiled when that isn't unambiguous.
    if (!cls) {
      const seats = await Enrollment.find({ userId: family._id, paymentStatus: { $ne: 'refunded' } })
        .select('classId studentName')
        .lean();
      const live = await Class.find({ _id: { $in: seats.map((e) => e.classId) } })
        .select('name schedule quarter')
        .lean();
      const r = classifyNote(
        { text, studentName: name, createdAt: new Date() },
        seats,
        new Map(live.map((c) => [String(c._id), c])),
      );
      if (r.classId) {
        cls = live.find((c) => String(c._id) === String(r.classId));
        name = r.studentName;
        date = date || r.lessonDate;
      }
    }

    const tutorName =
      tutor?.name ||
      [author.firstName, author.lastName].filter(Boolean).join(' ') ||
      author.name ||
      'Dotori School';

    const feedback = await Feedback.create({
      userId: family._id,
      tutorId: tutor?._id || null,
      tutorName,
      studentName: name,
      classId: cls?._id || null,
      lessonDate: date,
      text: text.trim(),
    });

    let emailed = false;
    if (family.email) {
      try {
        await sendFeedbackNotification({
          to: family.email,
          parentName: family.firstName || family.name || '',
          notes: [{ studentName: feedback.studentName || 'your student', className: cls?.name || '', lessonLabel: '', tutorName }],
          siteUrl: process.env.SITE_URL || '',
        });
        emailed = true;
      } catch (err) {
        console.error('Feedback notification failed:', err);
      }
    }
    return Response.json({ ok: true, emailed, feedback: { ...feedback.toObject(), canEdit: true, className: cls?.name || '' } });
  } catch (err) {
    console.error('Create feedback error:', err);
    return Response.json({ error: 'Failed to save feedback.' }, { status: 500 });
  }
}
