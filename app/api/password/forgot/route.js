import crypto from 'crypto';
import { after } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { sendPasswordReset } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// POST /api/password/forgot  body { email }
// Always answers the same way, found or not — this endpoint must never confirm
// whether an email has an account. When it does match one, a single-use token
// (only its SHA-256 is stored) goes out by email and dies in an hour. Lives
// under /api/password, not /api/auth, to stay clear of the Auth.js catch-all.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = body?.email?.toString().trim().toLowerCase();
  if (!email || !email.includes('@') || email.length > 200) {
    return Response.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  // Best-effort dampening (see lib/rate-limit.js): per-IP for spray, per-email
  // so one address cannot be flooded with reset mail.
  const ip = clientIp(request);
  if (!rateLimit(`pwforgot:ip:${ip}`, { max: 8, windowMs: 60 * 60 * 1000 }).ok ||
      !rateLimit(`pwforgot:email:${email}`, { max: 3, windowMs: 60 * 60 * 1000 }).ok) {
    return Response.json(
      { error: 'Too many reset requests. Please try again in a little while.' },
      { status: 429 },
    );
  }

  // One sentence for every outcome — and one RESPONSE TIME for every outcome.
  // The lookup, the token write, and the email send all happen after the
  // response has gone out (after() keeps the function alive for them), because
  // a response that awaits an SMTP round-trip only when the account exists is
  // a timing oracle that undoes the uniform wording.
  after(async () => {
    try {
      const db = (await clientPromise).db();
      const user = await db.collection('users').findOne({ email });
      if (!user) return;

      const token = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { resetTokenHash, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) } },
      );

      const siteUrl = process.env.SITE_URL || 'https://www.dotorischool.org';
      await sendPasswordReset({
        to: email,
        parentName: user.firstName || user.name || 'there',
        resetUrl: `${siteUrl}/reset-password?token=${token}`,
      });
    } catch (err) {
      // The answer already went out and stays the same — logging is for us.
      console.error('Password reset request failed:', err?.message || err);
    }
  });

  return Response.json({
    ok: true,
    message: 'If an account exists for that email, a reset link is on its way.',
  });
}
