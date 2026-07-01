import Booking from '@/lib/models/Booking';
import User from '@/lib/models/User'; // registers model for populate()
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tutor/bookings — the signed-in tutor's own upcoming bookings.
export async function GET() {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();
  void User;

  const bookings = await Booking.find({ tutorId: tutor._id, startAt: { $gte: new Date() } })
    .populate('userId', 'firstName lastName email name')
    .sort({ startAt: 1 })
    .limit(500);
  return Response.json({ bookings });
}
