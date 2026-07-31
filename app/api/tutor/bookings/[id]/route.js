import { formatInTimeZone } from 'date-fns-tz';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import SessionCredit from '@/lib/models/SessionCredit';
import RecurringBooking from '@/lib/models/RecurringBooking';
import { SITE_TIMEZONE } from '@/lib/slots';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';

export const dynamic = 'force-dynamic';

// DELETE /api/tutor/bookings/:id: the tutor cancels a session on their own
// schedule, or undoes one they logged after the fact ('completed'). Because the
// tutor (not the family) is cancelling, any consumed session credit is always
// refunded. If the session belonged to a standing weekly booking, the date is
// recorded so the cron won't re-book it.
export async function DELETE(request, { params }) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  try {
    const { id } = await params;
    await dbConnect();

    const booking = await Booking.findOne({ _id: id, tutorId: tutor._id });
    if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.status === 'cancelled') {
      return Response.json({ error: 'This booking is already cancelled.' }, { status: 400 });
    }
    const wasLogged = booking.status === 'completed';

    booking.status = 'cancelled';
    await booking.save();

    let refunded = false;
    if (booking.creditId) {
      await SessionCredit.findByIdAndUpdate(booking.creditId, { $inc: { remainingSessions: 1 } });
      refunded = true;
    }

    if (booking.recurringId) {
      const dateKey = formatInTimeZone(booking.startAt, SITE_TIMEZONE, 'yyyy-MM-dd');
      await RecurringBooking.findByIdAndUpdate(booking.recurringId, {
        $addToSet: { skipDates: dateKey },
      });
    }

    const what = wasLogged ? 'Logged session removed' : 'Session cancelled';
    return Response.json({
      ok: true,
      refunded,
      message: refunded ? `${what} and the family's session credit was refunded.` : `${what}.`,
    });
  } catch (err) {
    console.error('Tutor cancel error:', err);
    return Response.json({ error: 'Failed to cancel the booking.' }, { status: 500 });
  }
}
