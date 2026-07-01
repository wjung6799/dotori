import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import SessionCredit from '@/lib/models/SessionCredit';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/booking/cancel — body: { bookingId }. Cancels the family's own
// booking and refunds the session credit it consumed.
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { bookingId } = (await request.json()) || {};
    if (!bookingId) return Response.json({ error: 'bookingId is required.' }, { status: 400 });

    await dbConnect();
    const booking = await Booking.findOne({ _id: bookingId, userId: user._id });
    if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.status !== 'scheduled') {
      return Response.json({ error: 'This booking can no longer be cancelled.' }, { status: 400 });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Refund the credit it consumed.
    if (booking.creditId) {
      await SessionCredit.findByIdAndUpdate(booking.creditId, {
        $inc: { remainingSessions: 1 },
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Cancel error:', err);
    return Response.json({ error: 'Failed to cancel the booking.' }, { status: 500 });
  }
}
