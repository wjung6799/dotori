import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';
import { getMyTutor } from '@/lib/tutor-helpers';
import { unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/tutor/feedback/batch
// body: { classId, lessonDate: 'YYYY-MM-DD', notes: [{ userId, studentName, text }] }
// Saves one note per non-empty entry. No email goes out (owner's call,
// 2026-11-08): families read notes on their Reports & feedback page. Blank
// entries are skipped, not rejected, so the instructor can write for the
// students who need it and send the rest empty.
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
      .select('_id')
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

    return Response.json({
      ok: true,
      saved: created.length,
      feedback: created.map((fb) => ({ ...fb.toObject(), canEdit: true, className: cls?.name || '' })),
    });
  } catch (err) {
    console.error('Batch feedback error:', err);
    return Response.json({ error: 'Failed to send feedback.' }, { status: 500 });
  }
}
