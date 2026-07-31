import { formatInTimeZone } from 'date-fns-tz';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import SessionCredit from '@/lib/models/SessionCredit';
import RecurringBooking from '@/lib/models/RecurringBooking';
import { SITE_TIMEZONE } from '@/lib/slots';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Refund policy: a session credit is only refunded when the family cancels at
// least 12 hours before the session starts.
const REFUND_CUTOFF_MS = 12 * 60 * 60 * 1000;

function refundIfDue(booking) {
  const refundable = booking.startAt.getTime() - Date.now() >= REFUND_CUTOFF_MS;
  if (refundable && booking.creditId) {
    return SessionCredit.findByIdAndUpdate(booking.creditId, {
      $inc: { remainingSessions: 1 },
    }).then(() => true);
  }
  return Promise.resolve(false);
}

// POST /api/booking/cancel
//   { bookingId }                → cancel one session (and, if it belongs to a
//                                  recurring series, stop the cron re-booking
//                                  that week).
//   { recurringId, series:true } → stop the standing weekly booking and cancel
//                                  its future sessions.
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { bookingId, recurringId, series } = (await request.json()) || {};

    await dbConnect();

    // ---- Cancel the whole standing weekly booking. ----
    if (series && recurringId) {
      const rb = await RecurringBooking.findOne({ _id: recurringId, userId: user._id });
      if (!rb) return Response.json({ error: 'Recurring booking not found.' }, { status: 404 });

      rb.status = 'cancelled';
      await rb.save();

      // Cancel future sessions this series created; refund those outside 12h.
      const future = await Booking.find({
        recurringId: rb._id,
        userId: user._id,
        status: 'scheduled',
        startAt: { $gt: new Date() },
      });
      let refunded = 0;
      for (const b of future) {
        b.status = 'cancelled';
        await b.save();
        if (await refundIfDue(b)) refunded += 1;
      }

      return Response.json({
        ok: true,
        cancelledSeries: true,
        cancelledSessions: future.length,
        refunded,
        message: `Your weekly booking was cancelled. ${future.length} upcoming session${
          future.length === 1 ? '' : 's'
        } cancelled${refunded ? `, ${refunded} credit${refunded === 1 ? '' : 's'} refunded` : ''}.`,
      });
    }

    // ---- Cancel a single session. ----
    if (!bookingId) return Response.json({ error: 'bookingId is required.' }, { status: 400 });

    const booking = await Booking.findOne({ _id: bookingId, userId: user._id });
    if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.status !== 'scheduled') {
      return Response.json({ error: 'This booking can no longer be cancelled.' }, { status: 400 });
    }

    booking.status = 'cancelled';
    await booking.save();
    const refunded = await refundIfDue(booking);

    // If it was one week of a standing booking, make sure the cron doesn't just
    // re-book it: record the date as a skip on the series (series stays active).
    if (booking.recurringId) {
      const dateKey = formatInTimeZone(booking.startAt, SITE_TIMEZONE, 'yyyy-MM-dd');
      await RecurringBooking.findByIdAndUpdate(booking.recurringId, {
        $addToSet: { skipDates: dateKey },
      });
    }

    return Response.json({
      ok: true,
      refunded,
      message: refunded
        ? 'Your session was cancelled and a session credit was refunded.'
        : 'Your session was cancelled. Cancellations within 12 hours of the start time are not refundable, so no credit was returned.',
    });
  } catch (err) {
    console.error('Cancel error:', err);
    return Response.json({ error: 'Failed to cancel the booking.' }, { status: 500 });
  }
}
