import nodemailer from 'nodemailer';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/contact: contact form submission → email to info@dotorischool.org.
// Fields: studentName, grade, parentName, email, phone, note (optional).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Honeypot: bots fill it; pretend success.
  if (body?.website) return Response.json({ ok: true });

  const ip = clientIp(request);
  if (!rateLimit(`contact:ip:${ip}`, { max: 6, windowMs: 60 * 60 * 1000 }).ok) {
    return Response.json({ error: 'Too many requests. Please try again in a little while.' }, { status: 429 });
  }

  const fields = {};
  for (const k of ['studentName', 'grade', 'parentName', 'email', 'phone']) {
    const v = body?.[k]?.toString().trim();
    if (!v) return Response.json({ error: 'All required fields must be filled out.' }, { status: 400 });
    fields[k] = v.slice(0, 200);
  }
  if (!EMAIL_RE.test(fields.email)) {
    return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  const note = (body?.note || '').toString().trim().slice(0, 3000);

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"${fields.parentName}" <${process.env.SMTP_USER}>`,
      replyTo: fields.email,
      to: 'info@dotorischool.org',
      subject: `Contact Form: ${fields.parentName} (student: ${fields.studentName})`,
      text: [
        `Student: ${fields.studentName} (Grade ${fields.grade})`,
        `Parent: ${fields.parentName}`,
        `Email: ${fields.email}`,
        `Phone: ${fields.phone}`,
        `Note: ${note || 'No note'}`,
      ].join('\n'),
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Student:</strong> ${fields.studentName} (Grade ${fields.grade})</p>
        <p><strong>Parent:</strong> ${fields.parentName}</p>
        <p><strong>Email:</strong> ${fields.email}</p>
        <p><strong>Phone:</strong> ${fields.phone}</p>
        <p><strong>Note:</strong></p>
        <p>${note ? note.replace(/</g, '&lt;').replace(/\n/g, '<br/>') : 'No note'}</p>
      `,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return Response.json({ error: 'Failed to send your message. Please email info@dotorischool.org.' }, { status: 500 });
  }
}
