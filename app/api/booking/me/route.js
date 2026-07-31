import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import Booking from '@/lib/models/Booking';
import RecurringBooking from '@/lib/models/RecurringBooking';
import Tutor from '@/lib/models/Tutor'; // registers model for populate()
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/booking/me: the signed-in family's credit balance + their bookings.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    await dbConnect();
    void Tutor;

    const credits = await SessionCredit.find({ userId: user._id, remainingSessions: { $gt: 0 } })
      .populate('tutorId', 'name')
      .sort({ createdAt: 1 })
      .lean();

    const totalRemaining = credits.reduce((sum, c) => sum + c.remainingSessions, 0);

    const bookings = await Booking.find({ userId: user._id })
      .populate('tutorId', 'name')
      .sort({ startAt: -1 })
      .lean();

    // Standing weekly bookings still running (for the "recurring" badge + the
    // "cancel weekly" control on the schedule page).
    const recurring = await RecurringBooking.find({
      userId: user._id,
      status: { $in: ['active', 'paused'] },
    })
      .populate('tutorId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({ totalRemaining, credits, bookings, recurring });
  } catch (err) {
    console.error('Booking me error:', err);
    return Response.json({ error: 'Failed to load your bookings.' }, { status: 500 });
  }
}
