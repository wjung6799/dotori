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

    // Expired grants are not spendable, so they must not be counted either — a
    // balance the booking route then refuses is worse than no balance at all.
    // A null expiry is a grant made before expiry existed: usable forever.
    const now = new Date();
    const credits = await SessionCredit.find({
      userId: user._id,
      remainingSessions: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    })
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

    // Shown separately so a family can see what has lapsed rather than watching
    // a number quietly shrink.
    const expired = await SessionCredit.find({
      userId: user._id,
      remainingSessions: { $gt: 0 },
      expiresAt: { $ne: null, $lt: now },
    })
      .populate('tutorId', 'name')
      .sort({ expiresAt: -1 })
      .lean();

    // Grouped by tutor AND kind. A single total would tell a family they have
    // sessions for a slot their credits cannot pay for.
    const byTutorAndType = {};
    for (const c of credits) {
      const tid = c.tutorId ? String(c.tutorId._id ?? c.tutorId) : 'any';
      const type = c.sessionType || 'any';
      const key = `${tid}|${type}`;
      byTutorAndType[key] = (byTutorAndType[key] || 0) + (c.remainingSessions || 0);
    }

    return Response.json({ totalRemaining, byTutorAndType, credits, expired, bookings, recurring });
  } catch (err) {
    console.error('Booking me error:', err);
    return Response.json({ error: 'Failed to load your bookings.' }, { status: 500 });
  }
}
