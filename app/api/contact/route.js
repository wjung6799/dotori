import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

// POST /api/contact — contact form submission → email to info@dotorischool.org
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { parentFirstName, parentLastName, email, phone, message, newsletter, students } =
    body || {};

  if (!parentFirstName || !parentLastName || !email || !phone) {
    return Response.json({ error: 'All required fields must be filled out.' }, { status: 400 });
  }
  if (!students || students.length === 0 || !students[0]) {
    return Response.json({ error: 'At least one student name is required.' }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const fullName = `${parentFirstName} ${parentLastName}`;
    const studentsText =
      students && students.length > 0
        ? `<p><strong>Students:</strong> ${students.join(', ')}</p>`
        : '';
    const newsletterText = newsletter
      ? '<p><strong>Newsletter:</strong> Yes, would like to receive updates</p>'
      : '';

    await transporter.sendMail({
      from: `"${fullName}" <${email}>`,
      to: 'info@dotorischool.org',
      subject: `Contact Form Submission from ${fullName}`,
      text: `Name: ${fullName}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nMessage: ${message || 'No message'}\nStudents: ${students ? students.join(', ') : 'None'}\nNewsletter: ${newsletter ? 'Yes' : 'No'}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Parent Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        ${studentsText}
        <p><strong>Message:</strong><br>${message || 'No message provided'}</p>
        ${newsletterText}
      `,
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error('Error sending email:', err);
    return Response.json({ error: 'Failed to send email.' }, { status: 500 });
  }
}
