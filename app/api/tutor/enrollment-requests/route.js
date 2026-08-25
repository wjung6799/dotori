import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import EnrollmentRequest from '@/lib/models/EnrollmentRequest';
import Enrollment from '@/lib/models/Enrollment';
import User from '@/lib/models/User';
import { getTutorOrAdmin, unauthorized } from '@/lib/auth-helpers';
import { getMyTutor } from '@/lib/tutor-helpers';

export const dynamic = 'force-dynamic';

// Instructors see who is ready to move up, but placing a seat also bills a
// family — so they propose and the office decides. Approval is what creates the
// Enrollment and its Invoice; nothing here charges anyone.

// GET /api/tutor/enrollment-requests: this instructor's own proposals.
export async function GET() {
  if (!(await getTutorOrAdmin())) return unauthorized();
  const { tutor } = await getMyTutor();
  if (!tutor) return Response.json({ requests: [] });

  await dbConnect();
  void User;
  void Class;
  const requests = await EnrollmentRequest.find({ tutorId: tutor._id })
    .populate('classId', 'name schedule quarter price')
    .populate('userId', 'firstName lastName name email')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return Response.json({
    requests: requests.map((r) => ({
      id: String(r._id),
      studentName: r.studentName,
      className: r.classId?.name || 'Class',
      schedule: r.classId?.schedule || '',
      familyName:
        [r.userId?.firstName, r.userId?.lastName].filter(Boolean).join(' ') ||
        r.userId?.name ||
        r.userId?.email ||
        '',
      note: r.note,
      status: r.status,
      declineReason: r.declineReason,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
    })),
  });
}

// POST /api/tutor/enrollment-requests  body { userId, studentName, classId, note }
export async function POST(request) {
  if (!(await getTutorOrAdmin())) return unauthorized();
  const { tutor } = await getMyTutor();
  if (!tutor) {
    return Response.json(
      { error: 'Your login is not linked to an instructor profile yet. Ask an admin to link it.' },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const userId = body?.userId?.toString();
  const classId = body?.classId?.toString();
  const studentName = body?.studentName?.toString().trim();
  const note = (body?.note || '').toString().trim().slice(0, 500);
  if (!userId || !classId || !studentName) {
    return Response.json({ error: 'Family, student and class are required.' }, { status: 400 });
  }

  await dbConnect();

  const cls = await Class.findById(classId);
  if (!cls || !cls.active) return Response.json({ error: 'Class not found.' }, { status: 404 });

  const already = await Enrollment.findOne({
    userId,
    classId,
    studentName,
    paymentStatus: { $ne: 'refunded' },
  });
  if (already) {
    return Response.json({ error: 'That student is already in this class.' }, { status: 409 });
  }

  const pending = await EnrollmentRequest.findOne({ userId, classId, studentName, status: 'pending' });
  if (pending) {
    return Response.json({ error: 'A request for that student is already waiting for the office.' }, { status: 409 });
  }

  // Seats are checked again at approval — this is only so an instructor is not
  // left proposing into a class that is already full.
  const seated = await Enrollment.countDocuments({ classId, paymentStatus: { $in: ['pending', 'paid'] } });
  if (seated >= (cls.capacity ?? 0)) {
    return Response.json({ error: `${cls.name} is full (${seated}/${cls.capacity}).` }, { status: 409 });
  }

  const created = await EnrollmentRequest.create({
    tutorId: tutor._id,
    tutorName: tutor.name,
    userId,
    studentName,
    classId,
    note,
  });

  return Response.json({ ok: true, id: String(created._id) }, { status: 201 });
}
