import { formatInTimeZone } from 'date-fns-tz';

import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import Tutor from '@/lib/models/Tutor';
import User from '@/lib/models/User';
import Booking from '@/lib/models/Booking';
import SessionCredit from '@/lib/models/SessionCredit';
import { slotTimesForDate, scheduleMatchesDate, SITE_TIMEZONE } from '@/lib/slots';
import { sendBookingConfirmation, sendTutorBookingAlert } from '@/lib/mailer';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

const MIN_LEAD_MS = 0; // last-minute booking allowed, right up to the slot start

// POST /api/booking/book — body: { scheduleId, dateKey: "YYYY-MM-DD", studentName }
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { scheduleId, dateKey, studentName } = (await request.json()) || {};
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
    if (!schedule || !schedule.active) {
      return Response.json({ error: 'That time is no longer available.' }, { status: 404 });
    }

    // Validate the requested date actually matches this schedule.
    if (!scheduleMatchesDate(schedule, dateKey)) {
      return Response.json({ error: 'That time is not offered on that date.' }, { status: 400 });
    }

    const { start, end } = slotTimesForDate(schedule, dateKey);
    if (start.getTime() < Date.now() + MIN_LEAD_MS) {
      return Response.json({ error: 'That time has already passed.' }, { status: 400 });
    }

    // Capacity check.
    const used = await Booking.countDocuments({
      scheduleId: schedule._id,
      startAt: start,
      status: 'scheduled',
    });
    if (used >= (schedule.capacity ?? 1)) {
      return Response.json({ error: 'That session is full.' }, { status: 409 });
    }

    // Prevent the same student being booked into the same slot twice.
    const dupe = await Booking.findOne({
      userId: user._id,
      scheduleId: schedule._id,
      startAt: start,
      studentName: studentName.trim(),
      status: 'scheduled',
    });
    if (dupe) {
      return Response.json({ error: 'That student is already booked for this session.' }, { status: 409 });
    }

    // Consume one session credit (tutor-specific first, else any-tutor), atomically.
    let credit = await SessionCredit.findOneAndUpdate(
      { userId: user._id, tutorId: schedule.tutorId, remainingSessions: { $gt: 0 } },
      { $inc: { remainingSessions: -1 } },
      { new: true },
    );
    if (!credit) {
      credit = await SessionCredit.findOneAndUpdate(
        { userId: user._id, tutorId: null, remainingSessions: { $gt: 0 } },
        { $inc: { remainingSessions: -1 } },
        { new: true },
      );
    }
    if (!credit) {
      return Response.json(
        { error: "You have no sessions left. Please contact us to add sessions to your account." },
        { status: 402 },
      );
    }

    try {
      const booking = await Booking.create({
        userId: user._id,
        studentName: studentName.trim(),
        tutorId: schedule.tutorId,
        scheduleId: schedule._id,
        creditId: credit._id,
        startAt: start,
        endAt: end,
        subject: schedule.subject || '',
      });

      // Best-effort notification emails — never let a mail failure break booking.
      const whenLabel =
        `${formatInTimeZone(start, SITE_TIMEZONE, 'EEE, MMM d, yyyy · h:mm a')}` +
        ` – ${formatInTimeZone(end, SITE_TIMEZONE, 'h:mm a')}`;
      const parentName = user.firstName || user.name || '';
      const tutor = await Tutor.findById(schedule.tutorId).select('name userId').catch(() => null);
      const siteUrl = process.env.SITE_URL || '';

      // Confirmation to the family.
      try {
        if (user.email) {
          await sendBookingConfirmation({
            to: user.email,
            parentName,
            studentName: studentName.trim(),
            tutorName: tutor?.name || 'your tutor',
            whenLabel,
            subject: schedule.subject || '',
            siteUrl,
          });
        }
      } catch (mailErr) {
        console.error('Family booking email failed:', mailErr);
      }

      // Notification to the tutor's linked login email (isolated from the above).
      try {
        if (tutor?.userId) {
          const tutorUser = await User.findById(tutor.userId).select('email firstName name');
          if (tutorUser?.email) {
            await sendTutorBookingAlert({
              to: tutorUser.email,
              tutorName: tutorUser.firstName || tutor.name || '',
              studentName: studentName.trim(),
              parentName: parentName || user.email || 'A family',
              whenLabel,
              subject: schedule.subject || '',
              siteUrl,
            });
          }
        }
      } catch (mailErr) {
        console.error('Tutor booking email failed:', mailErr);
      }

      return Response.json({ ok: true, booking });
    } catch (createErr) {
      // Roll the credit back if the booking insert failed.
      await SessionCredit.findByIdAndUpdate(credit._id, { $inc: { remainingSessions: 1 } });
      throw createErr;
    }
  } catch (err) {
    console.error('Book error:', err);
    return Response.json({ error: 'Failed to book the session.' }, { status: 500 });
  }
}
