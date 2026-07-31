import dbConnect from '@/lib/db';
import RecurringBooking from '@/lib/models/RecurringBooking';
import TutorSchedule from '@/lib/models/TutorSchedule';
import User from '@/lib/models/User';
import Tutor from '@/lib/models/Tutor';
import { fillRecurringSeries } from '@/lib/recurring';
import { DOW_LABELS, minuteLabel } from '@/lib/slots';
import { sendRecurringUpdate } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/cron/book-recurring: invoked daily by Vercel Cron (see vercel.json).
// Rolls every active standing weekly booking forward: books newly-in-horizon
// weeks, skips weeks that are full/not offered, and pauses a series when the
// family runs out of sessions. Families get a heads-up email only when there's
// something to report (new bookings, skipped weeks, or a pause). Auth: Vercel
// sends Authorization: Bearer CRON_SECRET; reject anything else.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  await dbConnect();
  const siteUrl = process.env.SITE_URL || '';
  const now = new Date();

  // Active series, plus ones paused only for lack of credits (so buying more
  // sessions auto-resumes them). Series paused because their slot was removed
  // stay dormant.
  const series = await RecurringBooking.find({
    $or: [{ status: 'active' }, { status: 'paused', pausedReason: 'no_credit' }],
  });
  let processed = 0;
  let emails = 0;

  for (const s of series) {
    try {
      const schedule = await TutorSchedule.findById(s.scheduleId);
      const fill = await fillRecurringSeries({ series: s, schedule, now });
      processed += 1;

      // Nothing to tell the family about → stay quiet.
      if (!fill.booked.length && !fill.skipped.length && !fill.paused) continue;

      const user = await User.findById(s.userId).select('email firstName name').catch(() => null);
      if (!user?.email) continue;
      const tutor = await Tutor.findById(s.tutorId).select('name').catch(() => null);

      const weeklyLabel = `Every ${DOW_LABELS[s.dayOfWeek] || ''} at ${minuteLabel(s.startMinute)}`;
      await sendRecurringUpdate({
        to: user.email,
        parentName: user.firstName || user.name || '',
        studentName: s.studentName,
        tutorName: tutor?.name || 'your tutor',
        weeklyLabel,
        booked: fill.booked,
        skipped: fill.skipped,
        paused: fill.paused,
        siteUrl,
      });
      emails += 1;
    } catch (err) {
      console.error('Recurring series failed:', String(s._id), err);
    }
  }

  return Response.json({ ok: true, processed, emails });
}
