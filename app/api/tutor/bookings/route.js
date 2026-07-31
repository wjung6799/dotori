import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import User from '@/lib/models/User'; // registers model for populate()
import TutorSchedule from '@/lib/models/TutorSchedule';
import RecurringBooking from '@/lib/models/RecurringBooking';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';
import { attemptBooking } from '@/lib/booking';
import { fillRecurringSeries, whenLabel } from '@/lib/recurring';
import { DOW_LABELS, minuteLabel } from '@/lib/slots';
import { sendBookingConfirmation, sendRecurringUpdate } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// GET /api/tutor/bookings: the signed-in tutor's own upcoming bookings, or
// with ?past=1 their recent past ones (newest first) so a session just logged
// after the fact can be checked and undone.
export async function GET(request) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();
  void User;

  const past = new URL(request.url).searchParams.get('past');
  const now = new Date();
  const bookings = await Booking.find(
    past
      ? { tutorId: tutor._id, status: { $in: ['scheduled', 'completed'] }, startAt: { $lt: now } }
      : { tutorId: tutor._id, status: 'scheduled', startAt: { $gte: now } },
  )
    .populate('userId', 'firstName lastName email name')
    .sort({ startAt: past ? -1 : 1 })
    .limit(past ? 100 : 500);
  return Response.json({ bookings });
}

const STATUS_FOR = { schedule_unavailable: 404, not_offered: 400, past: 400, full: 409, duplicate: 409, error: 500 };

// POST /api/tutor/bookings: the tutor books a family's student into one of the
// tutor's OWN slots. Draws down a session credit if the family has one; books
// anyway at zero balance (payment is settled offline). Body:
// { userId, studentName, scheduleId, dateKey, recurring?, logPast? }.
// When recurring is true (weekly slots only), it becomes a standing weekly
// booking the book-recurring cron keeps rolling forward.
// When logPast is true the slot may already have happened: the session is
// recorded as 'completed' (the student attended without booking) and no
// confirmation email goes out, since there is nothing left to confirm.
export async function POST(request) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  try {
    const { userId, studentName, scheduleId, dateKey, recurring, logPast } =
      (await request.json()) || {};
    if (!userId || !studentName || !studentName.trim() || !scheduleId || !dateKey) {
      return Response.json(
        { error: 'A family, student name, and a time slot are required.' },
        { status: 400 },
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return Response.json({ error: 'Invalid date.' }, { status: 400 });
    }

    await dbConnect();

    // The family must exist; the slot must be one of THIS tutor's slots.
    const family = await User.findById(userId).select('email firstName lastName name role');
    if (!family || family.role !== 'family') {
      return Response.json({ error: 'Family not found.' }, { status: 404 });
    }
    const schedule = await TutorSchedule.findById(scheduleId);
    if (!schedule || String(schedule.tutorId) !== String(tutor._id)) {
      return Response.json({ error: 'That time slot is not one of yours.' }, { status: 403 });
    }

    const name = studentName.trim();
    const attended = Boolean(logPast);
    // A diagnostic slot is free: mirror its kind and never consume a credit.
    const isDiagnostic = schedule.kind === 'diagnostic';
    const res = await attemptBooking({
      userId: family._id,
      studentName: name,
      schedule,
      dateKey,
      allowWithoutCredit: true,
      allowPast: attended,
      status: attended ? 'completed' : 'scheduled',
      kind: isDiagnostic ? 'diagnostic' : 'session',
      consumeCredit: !isDiagnostic,
    });
    if (!res.ok) {
      return Response.json({ error: res.error }, { status: STATUS_FOR[res.code] || 500 });
    }
    const label = whenLabel(res.start, res.end);
    const parentName = family.firstName || family.name || '';
    const siteUrl = process.env.SITE_URL || '';

    // A session that already happened is a record, not a plan: no series, no email.
    if (attended) {
      return Response.json({ ok: true, booking: res.booking, creditConsumed: res.creditConsumed, logged: true });
    }

    const effRecurrence = schedule.recurrence || (schedule.specificDate ? 'oneoff' : 'weekly');
    const wantsRecurring = Boolean(recurring) && effRecurrence === 'weekly';

    if (!wantsRecurring) {
      // Let the family know their tutor scheduled them (best-effort).
      try {
        if (family.email) {
          await sendBookingConfirmation({
            to: family.email,
            parentName,
            studentName: name,
            tutorName: tutor.name || 'your tutor',
            whenLabel: label,
            subject: schedule.subject || '',
            siteUrl,
          });
        }
      } catch (mailErr) {
        console.error('Tutor-booked confirmation email failed:', mailErr);
      }
      return Response.json({ ok: true, booking: res.booking, creditConsumed: res.creditConsumed });
    }

    // ---- Standing weekly booking, set up by the tutor. ----
    const series = await RecurringBooking.create({
      userId: family._id,
      studentName: name,
      tutorId: tutor._id,
      scheduleId: schedule._id,
      status: 'active',
      dayOfWeek: schedule.dayOfWeek ?? res.start.getDay(),
      startMinute: schedule.startMinute,
      subject: schedule.subject || '',
    });
    res.booking.recurringId = series._id;
    await res.booking.save();

    // Fill the rest of the horizon now (picked week returns as a silent dupe).
    const fill = await fillRecurringSeries({ series, schedule, from: res.start });
    const weeklyLabel = `Every ${DOW_LABELS[schedule.dayOfWeek ?? res.start.getDay()]} at ${minuteLabel(schedule.startMinute)}`;
    const bookedAll = [{ label }, ...fill.booked];

    try {
      if (family.email) {
        await sendRecurringUpdate({
          to: family.email,
          parentName,
          studentName: name,
          tutorName: tutor.name || 'your tutor',
          weeklyLabel,
          booked: bookedAll,
          skipped: fill.skipped,
          paused: fill.paused,
          siteUrl,
        });
      }
    } catch (mailErr) {
      console.error('Tutor recurring setup email failed:', mailErr);
    }

    return Response.json({
      ok: true,
      booking: res.booking,
      creditConsumed: res.creditConsumed,
      recurring: { id: series._id, booked: bookedAll.length, paused: fill.paused },
    });
  } catch (err) {
    console.error('Tutor book-on-behalf error:', err);
    return Response.json({ error: 'Failed to book the session.' }, { status: 500 });
  }
}
