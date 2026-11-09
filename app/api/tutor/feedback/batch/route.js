import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';
import { getMyTutor } from '@/lib/tutor-helpers';
import { unauthorized } from '@/lib/auth-helpers';
import { sendFeedbackNotification } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function lessonLabel(ymd) {
  if (!DATE_RE.test(ymd || '')) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// POST /api/tutor/feedback/batch
// body: { classId, lessonDate: 'YYYY-MM-DD', notes: [{ userId, studentName, text }] }
// Saves one note per non-empty entry, then emails each family once listing the
// notes that went to them. Blank entries are skipped, not rejected, so the
// instructor can write for the students who need it and send the rest empty.
export async function POST(request) {
  const { user: author, tutor } = await getMyTutor();
  if (!author) return unauthorized();

  try {
    const body = (await request.json()) || {};
    const classId = body.classId?.toString() || null;
    const lessonDate = DATE_RE.test(body.lessonDate || '') ? body.lessonDate : '';
    const entries = (Array.isArray(body.notes) ? body.notes : [])
      .map((n) => ({
        userId: n?.userId?.toString(),
        studentName: (n?.studentName || '').toString().trim(),
        text: (n?.text || '').toString().trim(),
      }))
      .filter((n) => n.userId && n.text);
    if (!entries.length) {
      return Response.json({ error: 'Write at least one note before sending.' }, { status: 400 });
    }

    await dbConnect();
    const cls = classId ? await Class.findById(classId).select('name').lean() : null;
    if (classId && !cls) return Response.json({ error: 'Class not found.' }, { status: 404 });

    const familyIds = [...new Set(entries.map((n) => n.userId))];
    const families = await User.find({ _id: { $in: familyIds }, role: 'family' })
      .select('firstName lastName name email')
      .lean();
    const famById = new Map(families.map((f) => [String(f._id), f]));
    const missing = entries.filter((n) => !famById.has(n.userId));
    if (missing.length) return Response.json({ error: 'A family on this roster no longer exists.' }, { status: 404 });

    const tutorName =
      tutor?.name ||
      [author.firstName, author.lastName].filter(Boolean).join(' ') ||
      author.name ||
      'Dotori School';

    const created = await Feedback.insertMany(
      entries.map((n) => ({
        userId: n.userId,
        tutorId: tutor?._id || null,
        tutorName,
        studentName: n.studentName,
        classId: cls?._id || null,
        lessonDate,
        text: n.text,
      })),
    );

    // Best-effort notifications, one per family; a mail failure never undoes
    // the saved notes.
    const siteUrl = process.env.SITE_URL || '';
    const label = lessonLabel(lessonDate);
    let emailed = 0;
    await Promise.all(
      familyIds.map(async (fid) => {
        const fam = famById.get(fid);
        if (!fam?.email) return;
        const notes = created
          .filter((fb) => String(fb.userId) === fid)
          .map((fb) => ({ studentName: fb.studentName || 'your student', className: cls?.name || '', lessonLabel: label, tutorName }));
        try {
          await sendFeedbackNotification({
            to: fam.email,
            parentName: fam.firstName || fam.name || '',
            notes,
            siteUrl,
          });
          emailed += 1;
        } catch (err) {
          console.error('Feedback notification failed:', err);
        }
      }),
    );

    return Response.json({
      ok: true,
      saved: created.length,
      emailed,
      feedback: created.map((fb) => ({ ...fb.toObject(), canEdit: true, className: cls?.name || '' })),
    });
  } catch (err) {
    console.error('Batch feedback error:', err);
    return Response.json({ error: 'Failed to send feedback.' }, { status: 500 });
  }
}
