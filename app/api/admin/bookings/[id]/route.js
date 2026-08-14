import { formatInTimeZone } from 'date-fns-tz';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import SessionCredit from '@/lib/models/SessionCredit';
import RecurringBooking from '@/lib/models/RecurringBooking';
import { SITE_TIMEZONE } from '@/lib/slots';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// DELETE /api/admin/bookings/:id — admin cancels any booking (placement tests
// included). Mirrors the tutor cancel: consumed credits are refunded, and a
// cancelled occurrence of a standing weekly booking is skipped by the cron.
// The seat reopens on the public schedule; the family is NOT emailed.
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const { id } = await params;
    await dbConnect();

    const booking = await Booking.findById(id);
    if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 });
    if (booking.status === 'cancelled') {
      return Response.json({ error: 'This booking is already cancelled.' }, { status: 400 });
    }

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

    return Response.json({
      ok: true,
      refunded,
      message: refunded ? "Booking cancelled and the family's session credit was refunded." : 'Booking cancelled.',
    });
  } catch (err) {
    console.error('Admin cancel error:', err);
    return Response.json({ error: 'Failed to cancel the booking.' }, { status: 500 });
  }
}
