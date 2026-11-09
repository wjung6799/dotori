import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import Enrollment from '@/lib/models/Enrollment';
import Feedback from '@/lib/models/Feedback';
import User from '@/lib/models/User';
import { getMyTutor } from '@/lib/tutor-helpers';
import { unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Sunday-first weekday index for the day named in a class's schedule string
// ("Thu 4:30-5:50" → 4). Lets the page default the lesson date to the most
// recent occurrence of that class.
const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
function dayOfWeek(schedule) {
  const m = String(schedule || '').match(/\b(sun|mon|tue|wed|thu|fri|sat)/i);
  return m ? DOW[m[1].toLowerCase()] : null;
}

// GET /api/tutor/classes: every active class with its roster, for the
// class-first feedback form. Each seat carries the family (who the note is
// addressed to) and the student's most recent note in this class, so the
// instructor can see what they said last time while writing the next one.
export async function GET() {
  const { user } = await getMyTutor();
  if (!user) return unauthorized();
  await dbConnect();
  void User; // registered for populate()

  // Monday-first by weekday, then start time; classes with no weekday (1:1,
  // Saturday semi-private blocks) go last.
  const minutes = (c) => {
    const m = String(c.schedule || '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  };
  const dayRank = (c) => {
    const d = dayOfWeek(c.schedule);
    return d == null ? 99 : (d + 6) % 7;
  };
  const classes = (await Class.find({ active: true }).sort({ createdAt: 1 }).lean()).sort(
    (a, b) => dayRank(a) - dayRank(b) || minutes(a) - minutes(b) || a.name.localeCompare(b.name),
  );
  const ids = classes.map((c) => c._id);
  const [enrollments, recent] = await Promise.all([
    Enrollment.find({ classId: { $in: ids }, paymentStatus: { $ne: 'refunded' } })
      .populate('userId', 'firstName lastName name email')
      .sort({ studentName: 1 })
      .lean(),
    Feedback.find({ classId: { $in: ids } }).sort({ createdAt: -1 }).limit(2000).lean(),
  ]);

  // Latest note per (class, family, student), matched case-insensitively on
  // the student name since enrollments and notes are both typed by hand.
  const last = new Map();
  for (const fb of recent) {
    const key = `${fb.classId}|${fb.userId}|${(fb.studentName || '').trim().toLowerCase()}`;
    if (!last.has(key)) last.set(key, fb);
  }

  const byClass = new Map(ids.map((id) => [String(id), []]));
  for (const e of enrollments) {
    if (!e.userId) continue;
    const key = `${e.classId}|${e.userId._id}|${(e.studentName || '').trim().toLowerCase()}`;
    const prev = last.get(key) || null;
    byClass.get(String(e.classId)).push({
      enrollmentId: e._id,
      userId: e.userId._id,
      studentName: e.studentName,
      family: {
        name: [e.userId.firstName, e.userId.lastName].filter(Boolean).join(' ') || e.userId.name || e.userId.email,
        email: e.userId.email,
      },
      lastNote: prev
        ? { text: prev.text, lessonDate: prev.lessonDate || '', createdAt: prev.createdAt }
        : null,
    });
  }

  return Response.json({
    classes: classes.map((c) => ({
      _id: c._id,
      name: c.name,
      category: c.category,
      quarter: c.quarter,
      schedule: c.schedule,
      dayOfWeek: dayOfWeek(c.schedule),
      roster: byClass.get(String(c._id)) || [],
    })),
  });
}
