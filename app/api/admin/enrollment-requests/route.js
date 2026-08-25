import dbConnect from '@/lib/db';
import EnrollmentRequest from '@/lib/models/EnrollmentRequest';
import Class from '@/lib/models/Class';
import User from '@/lib/models/User';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/enrollment-requests?status=pending
// The office's queue of instructor proposals. Pending first, because that is
// the only status anyone needs to act on.
export async function GET(request) {
  if (!(await getAdminUser())) return forbidden();

  await dbConnect();
  void Class;
  void User;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const filter = ['pending', 'approved', 'declined'].includes(status) ? { status } : {};

  const requests = await EnrollmentRequest.find(filter)
    .populate('classId', 'name schedule quarter price capacity')
    .populate('userId', 'firstName lastName name email phone students')
    .sort({ status: 1, createdAt: -1 })
    .limit(300)
    .lean();

  return Response.json({
    requests: requests.map((r) => ({
      id: String(r._id),
      tutorName: r.tutorName,
      studentName: r.studentName,
      note: r.note,
      status: r.status,
      declineReason: r.declineReason,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      decidedBy: r.decidedBy,
      family: {
        id: String(r.userId?._id || ''),
        name:
          [r.userId?.firstName, r.userId?.lastName].filter(Boolean).join(' ') ||
          r.userId?.name ||
          r.userId?.email ||
          'Unknown family',
        email: r.userId?.email || '',
      },
      class: {
        id: String(r.classId?._id || ''),
        name: r.classId?.name || 'Class',
        schedule: r.classId?.schedule || '',
        quarter: r.classId?.quarter || '',
        priceCents: Math.round(Number(r.classId?.price || 0) * 100),
      },
    })),
    pendingCount: await EnrollmentRequest.countDocuments({ status: 'pending' }),
  });
}
