import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import clientPromise from '@/lib/mongodb';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { sendPasswordChanged } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// POST /api/password/reset  body { token, password }
// Trades a live reset token for a new password. The token is matched by its
// SHA-256 against what /forgot stored, must not have expired, and is cleared
// the moment it is spent — a reset link never works twice.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const token = body?.token?.toString() || '';
  const password = body?.password?.toString() || '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return Response.json({ error: 'That reset link is invalid or has expired.' }, { status: 400 });
  }
  // Mirrors /api/register: eight characters is the floor everywhere.
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const ip = clientIp(request);
  if (!rateLimit(`pwreset:ip:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 }).ok) {
    return Response.json(
      { error: 'Too many attempts. Please try again in a little while.' },
      { status: 429 },
    );
  }

  try {
    const db = (await clientPromise).db();
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const passwordHash = await bcrypt.hash(password, 10);

    // Match and spend the token in ONE write, so two tabs racing the same link
    // cannot both succeed.
    const user = await db.collection('users').findOneAndUpdate(
      { resetTokenHash, resetTokenExpiresAt: { $gt: new Date() } },
      {
        // passwordChangedAt is what evicts sessions issued before the reset:
        // auth.js compares it against the pwt stamped into each JWT.
        $set: { passwordHash, passwordChangedAt: new Date() },
        $unset: { resetTokenHash: '', resetTokenExpiresAt: '' },
      },
    );
    if (!user) {
      return Response.json({ error: 'That reset link is invalid or has expired.' }, { status: 400 });
    }

    // Best-effort: the owner should hear about a change they may not have made.
    try {
      await sendPasswordChanged({
        to: user.email,
        parentName: user.firstName || user.name || 'there',
        siteUrl: process.env.SITE_URL || 'https://www.dotorischool.org',
      });
    } catch (mailErr) {
      console.error('Password-changed email failed:', mailErr?.message || mailErr);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Password reset failed:', err);
    return Response.json({ error: 'Could not reset the password. Please try again.' }, { status: 500 });
  }
}
