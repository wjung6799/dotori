import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import User from '@/lib/models/User';   // registers model for populate()
import Tutor from '@/lib/models/Tutor';  // registers model for populate()
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/bookings?status=&tutorId=&upcoming=1
export async function GET(request) {
  if (!(await getAdminUser())) return forbidden();
  try {
    await dbConnect();
    void User;
    void Tutor;
    const { searchParams } = new URL(request.url);
    const filter = {};
    if (searchParams.get('status')) filter.status = searchParams.get('status');
    if (searchParams.get('tutorId')) filter.tutorId = searchParams.get('tutorId');
    if (searchParams.get('upcoming')) filter.startAt = { $gte: new Date() };

    const bookings = await Booking.find(filter)
      .populate('userId', 'firstName lastName email name')
      .populate('tutorId', 'name')
      .sort({ startAt: -1 })
      .limit(500);
    return Response.json({ bookings });
  } catch (err) {
    console.error('Admin bookings fetch error:', err);
    return Response.json({ error: 'Failed to fetch bookings.' }, { status: 500 });
  }
}
