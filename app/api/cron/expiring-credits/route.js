import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import User from '@/lib/models/User';
import Tutor from '@/lib/models/Tutor';
import { sendCreditsExpiring } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/cron/expiring-credits: invoked daily by Vercel Cron (see vercel.json).
//
// Warns a family before sessions they have paid for lapse. Without this, an
// expiry window is a trap — the pricing FAQ promises the opposite ("we're
// gracious... just ask and we'll extend it once"), and that promise is only real
// if the family finds out in time to ask.
//
// Two stages, once each: a month out, and a final week. The stage is recorded on
// the grant so the sweep does not mail the same family every morning.
const STAGES = [30, 7];

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  await dbConnect();
  void Tutor;

  const now = new Date();
  const horizon = new Date(now.getTime() + STAGES[0] * 24 * 60 * 60 * 1000);

  const due = await SessionCredit.find({
    remainingSessions: { $gt: 0 },
    // A null expiry never lapses, so it is never warned about.
    expiresAt: { $ne: null, $gte: now, $lte: horizon },
  })
    .populate('tutorId', 'name')
    .limit(500);

  const result = { considered: due.length, emailed: 0, skipped: 0, failed: 0 };
  const siteUrl = process.env.SITE_URL || 'https://www.dotorischool.org';

  for (const credit of due) {
    const daysLeft = Math.ceil((new Date(credit.expiresAt) - now) / (24 * 60 * 60 * 1000));
    // The tightest stage this grant has crossed and not yet been told about.
    const stage = STAGES.filter((d) => daysLeft <= d).sort((a, b) => a - b)[0];
    if (!stage || (credit.expiryRemindersSent || []).includes(stage)) {
      result.skipped += 1;
      continue;
    }

    const user = await User.findById(credit.userId).select('email firstName lastName name');
    if (!user?.email) {
      result.skipped += 1;
      continue;
    }

    try {
      await sendCreditsExpiring({
        to: user.email,
        parentName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || 'there',
        sessions: credit.remainingSessions,
        tutorName: credit.tutorId?.name || '',
        expiresAt: credit.expiresAt,
        daysLeft,
        siteUrl,
      });
      // Marked only after the send succeeds, so a mail outage means a retry
      // tomorrow rather than a warning nobody ever got.
      credit.expiryRemindersSent = [...(credit.expiryRemindersSent || []), stage];
      await credit.save();
      result.emailed += 1;
    } catch (err) {
      console.error('Expiry reminder failed for credit', String(credit._id), err?.message || err);
      result.failed += 1;
    }
  }

  return Response.json(result);
}
