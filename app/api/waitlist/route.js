import dbConnect from '@/lib/db';
import Waitlist from '@/lib/models/Waitlist';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/waitlist: PUBLIC, no auth. Join the waitlist for 1:1 sessions.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: a hidden field real users never see. Bots fill it; pretend success.
  if (body?.website) return Response.json({ ok: true });

  // Best-effort per-IP throttle (see lib/rate-limit.js caveats).
  const ip = clientIp(request);
  if (!rateLimit(`waitlist:ip:${ip}`, { max: 6, windowMs: 60 * 60 * 1000 }).ok) {
    return Response.json({ error: 'Too many requests. Please try again in a little while.' }, { status: 429 });
  }

  const fields = {};
  for (const k of ['studentName', 'grade', 'parentName', 'phone', 'email', 'subject']) {
    const v = body?.[k]?.toString().trim();
    if (!v) return Response.json({ error: 'Please fill in every field.' }, { status: 400 });
    fields[k] = v.slice(0, k === 'subject' ? 500 : 200);
  }
  fields.email = fields.email.toLowerCase();
  if (!EMAIL_RE.test(fields.email)) {
    return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  try {
    await dbConnect();
    // One waitlist spot per student per family email.
    const existing = await Waitlist.findOne({ program: '1on1', email: fields.email, studentName: fields.studentName });
    if (existing) {
      return Response.json({ error: 'This student is already on the waitlist. We will reach out when a spot opens.' }, { status: 409 });
    }
    await Waitlist.create({ program: '1on1', ...fields });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('Waitlist create error:', err);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
