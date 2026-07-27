import { sendDiagnosticRequestAlert, sendDiagnosticRequestConfirmation } from '@/lib/mailer';
import { rateLimit, check, record, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRACK_LABEL = { math: 'Math & Test Prep', language: 'Language', both: 'Both (Language & Math)' };
const SCHOOL_EMAIL = process.env.CONTACT_EMAIL || 'info@dotorischool.org';

// POST /api/diagnostic/request — PUBLIC, no auth. A family sends a message asking
// for a free diagnostic; we email the school (the actual lead) and confirm to the
// parent. No slot/booking/credit — the school reaches out to schedule.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: hidden field real users never fill.
  if (body?.website) return Response.json({ ok: true });

  const ip = clientIp(request);
  if (!rateLimit(`diagreq:ip:${ip}`, { max: 8, windowMs: 60 * 60 * 1000 }).ok) {
    return Response.json({ error: 'Too many requests. Please try again in a little while.' }, { status: 429 });
  }

  // Strip CR/LF from single-line fields (defense-in-depth for the email subject).
  const oneLine = (s) => (s || '').replace(/[\r\n\t]+/g, ' ').trim();
  const parentName = oneLine(body?.parentName?.toString()).slice(0, 120);
  const email = body?.email?.toString().trim().toLowerCase().slice(0, 200);
  const phone = oneLine(body?.phone?.toString()).slice(0, 40);
  const studentName = oneLine(body?.studentName?.toString()).slice(0, 120);
  const message = (body?.message?.toString().trim() || '').slice(0, 2000);
  const trackLabel = TRACK_LABEL[body?.track] || '';

  if (!parentName || !email) {
    return Response.json({ error: 'Please add your name and email.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  // Gate on the per-email cap WITHOUT consuming a slot yet, so a failed send
  // (502) doesn't falsely lock the family out for 24h.
  const emailKey = `diagreq:email:${email}`;
  const emailWindow = { windowMs: 24 * 60 * 60 * 1000 };
  if (!check(emailKey, { max: 5, ...emailWindow }).ok) {
    return Response.json(
      { error: 'You’ve reached today’s limit. Please email info@dotorischool.org.' },
      { status: 429 },
    );
  }

  // The school alert IS the lead — if it can't send, tell the family to email
  // directly rather than falsely confirm.
  try {
    await sendDiagnosticRequestAlert({
      to: SCHOOL_EMAIL,
      parentName,
      email,
      phone,
      studentName,
      track: trackLabel,
      message,
    });
  } catch (err) {
    console.error('Diagnostic request alert failed:', err);
    return Response.json(
      { error: 'We couldn’t send your request just now. Please email info@dotorischool.org and we’ll set it up.' },
      { status: 502 },
    );
  }

  // Only now that a real request went through, consume the per-email slot.
  record(emailKey, emailWindow);

  // Parent confirmation is best-effort.
  let emailed = false;
  try {
    await sendDiagnosticRequestConfirmation({ to: email, parentName });
    emailed = true;
  } catch (err) {
    console.error('Diagnostic request confirmation failed:', err);
  }

  return Response.json({ ok: true, emailed });
}
