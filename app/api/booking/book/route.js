import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import Tutor from '@/lib/models/Tutor';
import User from '@/lib/models/User';
import RecurringBooking from '@/lib/models/RecurringBooking';
import { attemptBooking } from '@/lib/booking';
import { fillRecurringSeries, whenLabel } from '@/lib/recurring';
import { DOW_LABELS, minuteLabel } from '@/lib/slots';
import {
  sendBookingConfirmation,
  sendTutorBookingAlert,
  sendRecurringUpdate,
} from '@/lib/mailer';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Map an attemptBooking failure code to an HTTP status.
const STATUS_FOR = {
  schedule_unavailable: 404,
  not_offered: 400,
  past: 400,
  full: 409,
  duplicate: 409,
  no_credit: 402,
  error: 500,
};

// POST /api/booking/book — body: { scheduleId, dateKey, studentName, recurring? }
// When recurring is true and the slot is a weekly one, the family's slot becomes
// a standing weekly booking: the picked week is booked now, the next few weeks
// are filled immediately, and the book-recurring cron rolls it forward.
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { scheduleId, dateKey, studentName, recurring } = (await request.json()) || {};
    if (!scheduleId || !dateKey || !studentName || !studentName.trim()) {
      return Response.json(
        { error: 'scheduleId, dateKey and studentName are required.' },
        { status: 400 },
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return Response.json({ error: 'Invalid date.' }, { status: 400 });
    }

    await dbConnect();
    const schedule = await TutorSchedule.findById(scheduleId);
    if (!schedule || !schedule.active || schedule.kind === 'diagnostic') {
      // Diagnostic slots are free and booked only via /api/booking/diagnostic;
      // they must never be claimed with a paid credit through this route.
      return Response.json({ error: 'That time is no longer available.' }, { status: 404 });
    }

    const name = studentName.trim();

    // Book the picked slot using the shared core (capacity, credit, rollback).
    const first = await attemptBooking({
      userId: user._id,
      studentName: name,
      schedule,
      dateKey,
    });
    if (!first.ok) {
      return Response.json({ error: first.error }, { status: STATUS_FOR[first.code] || 500 });
    }
    const { booking, start, end } = first;

    // Shared email context.
    const label = whenLabel(start, end);
    const parentName = user.firstName || user.name || '';
    const tutor = await Tutor.findById(schedule.tutorId).select('name userId').catch(() => null);
    const siteUrl = process.env.SITE_URL || '';

    // A standing weekly booking only makes sense for weekly slots.
    const effRecurrence = schedule.recurrence || (schedule.specificDate ? 'oneoff' : 'weekly');
    const wantsRecurring = Boolean(recurring) && effRecurrence === 'weekly';

    if (!wantsRecurring) {
      // ---- Single booking: behaviour unchanged. ----
      try {
        if (user.email) {
          await sendBookingConfirmation({
            to: user.email,
            parentName,
            studentName: name,
            tutorName: tutor?.name || 'your tutor',
            whenLabel: label,
            subject: schedule.subject || '',
            siteUrl,
          });
        }
      } catch (mailErr) {
        console.error('Family booking email failed:', mailErr);
      }
      try {
        if (tutor?.userId) {
          const tutorUser = await User.findById(tutor.userId).select('email firstName name');
          if (tutorUser?.email) {
            await sendTutorBookingAlert({
              to: tutorUser.email,
              tutorName: tutorUser.firstName || tutor.name || '',
              studentName: name,
              parentName: parentName || user.email || 'A family',
              whenLabel: label,
              subject: schedule.subject || '',
              siteUrl,
            });
          }
        }
      } catch (mailErr) {
        console.error('Tutor booking email failed:', mailErr);
      }
      return Response.json({ ok: true, booking });
    }

    // ---- Standing weekly booking. ----
    const series = await RecurringBooking.create({
      userId: user._id,
      studentName: name,
      tutorId: schedule.tutorId,
      scheduleId: schedule._id,
      status: 'active',
      dayOfWeek: schedule.dayOfWeek ?? start.getDay(),
      startMinute: schedule.startMinute,
      subject: schedule.subject || '',
    });
    booking.recurringId = series._id;
    await booking.save();

    // Fill the rest of the horizon now (the picked week comes back as a
    // silent 'duplicate', so it isn't double-counted).
    const fill = await fillRecurringSeries({ series, schedule, from: start });

    const weeklyLabel = `Every ${DOW_LABELS[schedule.dayOfWeek ?? start.getDay()]} at ${minuteLabel(schedule.startMinute)}`;
    const bookedAll = [{ label }, ...fill.booked];

    // Family: one recurring heads-up covering everything just booked.
    try {
      if (user.email) {
        await sendRecurringUpdate({
          to: user.email,
          parentName,
          studentName: name,
          tutorName: tutor?.name || 'your tutor',
          weeklyLabel,
          booked: bookedAll,
          skipped: fill.skipped,
          paused: fill.paused,
          siteUrl,
        });
      }
    } catch (mailErr) {
      console.error('Recurring setup email failed:', mailErr);
    }

    // Tutor: a single alert about the standing commitment (no weekly spam).
    try {
      if (tutor?.userId) {
        const tutorUser = await User.findById(tutor.userId).select('email firstName name');
        if (tutorUser?.email) {
          await sendTutorBookingAlert({
            to: tutorUser.email,
            tutorName: tutorUser.firstName || tutor.name || '',
            studentName: name,
            parentName: parentName || user.email || 'A family',
            whenLabel: `${weeklyLabel} (recurring) · first session ${label}`,
            subject: schedule.subject || '',
            siteUrl,
          });
        }
      }
    } catch (mailErr) {
      console.error('Tutor recurring email failed:', mailErr);
    }

    return Response.json({
      ok: true,
      booking,
      recurring: { id: series._id, booked: bookedAll.length, paused: fill.paused },
    });
  } catch (err) {
    console.error('Book error:', err);
    return Response.json({ error: 'Failed to book the session.' }, { status: 500 });
  }
}
