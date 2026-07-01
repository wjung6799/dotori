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

    // Refund policy: a session credit is only refunded when the family cancels
    // at least 12 hours before the session starts. Cancellations inside the
    // 12-hour window are non-refundable — the credit stays consumed.
    const REFUND_CUTOFF_MS = 12 * 60 * 60 * 1000;
    const refundable = booking.startAt.getTime() - Date.now() >= REFUND_CUTOFF_MS;

    booking.status = 'cancelled';
    await booking.save();

    if (refundable && booking.creditId) {
      await SessionCredit.findByIdAndUpdate(booking.creditId, {
        $inc: { remainingSessions: 1 },
      });
    }

    return Response.json({
      ok: true,
      refunded: refundable,
      message: refundable
        ? 'Your session was cancelled and a session credit was refunded.'
        : 'Your session was cancelled. Cancellations within 12 hours of the start time are not refundable, so no credit was returned.',
    });
  } catch (err) {
    console.error('Cancel error:', err);
    return Response.json({ error: 'Failed to cancel the booking.' }, { status: 500 });
  }
}
