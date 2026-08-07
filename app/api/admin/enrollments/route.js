import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import User from '@/lib/models/User';   // registers model for populate()
import Class from '@/lib/models/Class'; // registers model for populate()
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/enrollments
export async function GET(request) {
  if (!(await getAdminUser())) return forbidden();

  try {
    await dbConnect();
    void User;
    void Class;
    const { searchParams } = new URL(request.url);
    const filter = {};
    if (searchParams.get('quarter')) filter.quarter = searchParams.get('quarter');
    if (searchParams.get('status')) filter.paymentStatus = searchParams.get('status');

    const enrollments = await Enrollment.find(filter)
      .populate('userId', 'firstName lastName email phone name students')
      .populate('classId', 'name schedule price')
      .sort({ enrolledAt: -1 });
    return Response.json({ enrollments });
  } catch (err) {
    console.error('Admin enrollments fetch error:', err);
    return Response.json({ error: 'Failed to fetch enrollments.' }, { status: 500 });
  }
}

// POST /api/admin/enrollments: manually enroll a student in a class (no
// payment flow; the school records offline/Zelle payments this way). Feeds
// the live seat counts on the public literacy schedule.
export async function POST(request) {
  if (!(await getAdminUser())) return forbidden();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const userId = body?.userId?.toString();
  const classId = body?.classId?.toString();
  const studentName = body?.studentName?.toString().trim();
  const paymentStatus = ['pending', 'paid'].includes(body?.paymentStatus) ? body.paymentStatus : 'paid';
  const notes = (body?.notes || '').toString().trim().slice(0, 500);
  if (!userId || !classId || !studentName) {
    return Response.json({ error: 'Family, student, and class are required.' }, { status: 400 });
  }

  try {
    await dbConnect();
    const cls = await Class.findById(classId);
    if (!cls) return Response.json({ error: 'Class not found.' }, { status: 404 });

    const existing = await Enrollment.findOne({
      userId, classId, studentName, paymentStatus: { $ne: 'refunded' },
    });
    if (existing) {
      return Response.json({ error: 'That student is already enrolled in this class.' }, { status: 409 });
    }

    const seated = await Enrollment.countDocuments({
      classId, paymentStatus: { $in: ['pending', 'paid'] },
    });
    if (seated >= (cls.capacity ?? 0)) {
      return Response.json({ error: `Class is full (${seated}/${cls.capacity}).` }, { status: 409 });
    }

    const enrollment = await Enrollment.create({
      userId,
      classId,
      studentName,
      quarter: cls.quarter,
      paymentStatus,
      notes: notes || 'Added by admin',
      ...(paymentStatus === 'paid' ? { paidAt: new Date() } : {}),
    });
    return Response.json({ ok: true, enrollment }, { status: 201 });
  } catch (err) {
    console.error('Admin enrollment create error:', err);
    return Response.json({ error: 'Failed to create enrollment.' }, { status: 500 });
  }
}
