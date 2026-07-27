import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import Booking from '@/lib/models/Booking';
import Tutor from '@/lib/models/Tutor';
import User from '@/lib/models/User';
import { attemptBooking } from '@/lib/booking';
import { slotTimesForDate, scheduleMatchesDate } from '@/lib/slots';
import { whenLabel } from '@/lib/recurring';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { sendBookingConfirmation, sendTutorBookingAlert } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOLDS_SEAT = ['scheduled', 'completed'];

// attemptBooking failure code → HTTP status. No 'no_credit' here: a diagnostic
// never consumes a credit (consumeCredit:false).
const STATUS_FOR = {
  schedule_unavailable: 404,
  not_offered: 400,
  past: 400,
  full: 409,
  duplicate: 409,
  error: 500,
};

const TRACK_LABEL = { math: 'Math & Test Prep', language: 'Language', both: 'Both (Language & Math)' };

// POST /api/booking/diagnostic — PUBLIC, no auth. Books a free diagnostic
// assessment into a diagnostic-kind slot, creating a shell family account from
// the parent's contact details. Never touches session credits or paid slots.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: a hidden field real users never see. Bots fill it → pretend success.
  if (body?.website) return Response.json({ ok: true });

  // Best-effort per-IP throttle (see lib/rate-limit.js caveats).
  const ip = clientIp(request);
  if (!rateLimit(`diag:ip:${ip}`, { max: 8, windowMs: 60 * 60 * 1000 }).ok) {
    return Response.json({ error: 'Too many requests. Please try again in a little while.' }, { status: 429 });
  }

  const scheduleId = body?.scheduleId?.toString().trim();
  const dateKey = body?.dateKey?.toString().trim();
  const studentName = body?.studentName?.toString().trim().slice(0, 120);
  const parentName = body?.parentName?.toString().trim().slice(0, 120);
  const email = body?.email?.toString().trim().toLowerCase().slice(0, 200);
  const phone = (body?.phone?.toString().trim() || '').slice(0, 40);
  const trackLabel = TRACK_LABEL[body?.track] || '';

  if (!scheduleId || !dateKey || !studentName || !parentName || !email) {
    return Response.json(
      { error: 'Please add your name, email, the student’s name, and pick a time.' },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return Response.json({ error: 'Invalid date.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (!mongoose.isValidObjectId(scheduleId)) {
    return Response.json({ error: 'That time is no longer available.' }, { status: 404 });
  }
  // Per-email daily cap (a fresh email still faces the per-IP cap above).
  if (!rateLimit(`diag:email:${email}`, { max: 4, windowMs: 24 * 60 * 60 * 1000 }).ok) {
    return Response.json(
      { error: 'You’ve reached today’s limit for diagnostic requests. Please email info@dotorischool.org.' },
      { status: 429 },
    );
  }

  try {
    await dbConnect();

    const schedule = await TutorSchedule.findById(scheduleId);
    // Critical guard: only an active diagnostic-kind slot on a matching date can be
    // booked here — so a paid scheduleId can never be claimed for free.
    if (!schedule || !schedule.active || schedule.kind !== 'diagnostic' || !scheduleMatchesDate(schedule, dateKey)) {
      return Response.json({ error: 'That time is no longer available.' }, { status: 404 });
    }

    // Capacity pre-check BEFORE creating any account, so a full or bogus slot
    // can't be used to spam shell-user rows. attemptBooking re-checks atomically.
    const { start } = slotTimesForDate(schedule, dateKey);
    const seatsUsed = await Booking.countDocuments({
      scheduleId: schedule._id,
      startAt: start,
      status: { $in: HOLDS_SEAT },
    });
    if (seatsUsed >= (schedule.capacity ?? 1)) {
      return Response.json({ error: 'That session is full. Please pick another time.' }, { status: 409 });
    }

    // Find or create a shell family account. We never mutate an EXISTING account
    // from this unauthenticated route (the email isn't verified here) — we only
    // populate a brand-new shell row.
    let user = await User.findOne({ email });
    if (!user) {
      const parts = parentName.split(/\s+/).filter(Boolean);
      try {
        user = await User.create({
          email,
          name: parentName,
          firstName: parts.shift() || parentName,
          lastName: parts.join(' '),
          phone,
          role: 'family',
          passwordHash: '',
          students: [{ name: studentName }],
        });
      } catch (e) {
        // Lost a create race on the unique email → refetch the winner.
        if (e?.code === 11000) user = await User.findOne({ email });
        if (!user) throw e;
      }
    }

    // Abuse guard: one pending free diagnostic per family at a time.
    const pending = await Booking.findOne({
      userId: user._id,
      kind: 'diagnostic',
      status: 'scheduled',
      startAt: { $gte: new Date() },
    });
    if (pending) {
      return Response.json(
        { error: 'You already have a diagnostic scheduled — email us if you need to reschedule.' },
        { status: 409 },
      );
    }

    const res = await attemptBooking({
      userId: user._id,
      studentName,
      schedule,
      dateKey,
      allowWithoutCredit: true,
      consumeCredit: false,
      kind: 'diagnostic',
    });
    if (!res.ok) {
      return Response.json({ error: res.error }, { status: STATUS_FOR[res.code] || 500 });
    }

    // Stamp the booking with contact + track so the tutor/admin see it in context.
    try {
      res.booking.subject = schedule.subject || 'Free Diagnostic Assessment';
      res.booking.notes = [
        trackLabel && `Track: ${trackLabel}`,
        `Parent: ${parentName}`,
        `Email: ${email}`,
        phone && `Phone: ${phone}`,
      ]
        .filter(Boolean)
        .join(' · ');
      await res.booking.save();
    } catch {
      /* non-fatal: the booking already exists */
    }

    // Best-effort emails (a broken mail config must not fail the booking). Track
    // whether the family confirmation actually sent so the UI doesn't over-promise.
    const label = whenLabel(res.start, res.end);
    const siteUrl = process.env.SITE_URL || '';
    const tutor = await Tutor.findById(schedule.tutorId).select('name userId').catch(() => null);

    let emailed = false;
    try {
      await sendBookingConfirmation({
        to: email,
        parentName,
        studentName,
        tutorName: tutor?.name || 'our team',
        whenLabel: label,
        subject: 'Free Diagnostic Assessment',
        siteUrl,
      });
      emailed = true;
    } catch (mailErr) {
      console.error('Diagnostic family email failed:', mailErr);
    }
    try {
      if (tutor?.userId) {
        const tutorUser = await User.findById(tutor.userId).select('email firstName name');
        if (tutorUser?.email) {
          await sendTutorBookingAlert({
            to: tutorUser.email,
            tutorName: tutorUser.firstName || tutor.name || '',
            studentName,
            parentName: `${parentName} (${email}${phone ? ', ' + phone : ''})`,
            whenLabel: label,
            subject: `Free Diagnostic${trackLabel ? ' · ' + trackLabel : ''}`,
            siteUrl,
          });
        }
      }
    } catch (mailErr) {
      console.error('Diagnostic tutor email failed:', mailErr);
    }

    return Response.json({ ok: true, whenLabel: label, emailed });
  } catch (err) {
    console.error('Diagnostic booking error:', err);
    return Response.json(
      { error: 'Something went wrong. Please try again, or email us at info@dotorischool.org.' },
      { status: 500 },
    );
  }
}
