const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { studentName, parentName, email, phone, programs, notes } = req.body;
  if (!studentName || !parentName || !email || !phone || !programs || !Array.isArray(programs) || programs.length === 0) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const programListHtml = programs.map(p => `<li>${p}</li>`).join('');
  const invoiceHtml = `
    <h2>Dotori School Registration Invoice</h2>
    <p><strong>Student Name:</strong> ${studentName}</p>
    <p><strong>Parent/Guardian Name:</strong> ${parentName}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Programs:</strong></p>
    <ul>${programListHtml}</ul>
    <p><strong>Notes:</strong> ${notes || 'N/A'}</p>
    <hr>
    <p><strong>Invoice Amount:</strong> $100 (example)</p>
    <p>Please reply to this email to confirm your registration and payment method.</p>
  `;

  // Example program details (customize as needed or expand input structure)
  const programDetails = {
    'Writing (K-1)': { dayTime: 'Mon 4:30–5:30 PM', duration: '10 weeks (1x/week)', tuition: 700 },
    'Writing (2-3)': { dayTime: 'Tue 4:30–5:30 PM', duration: '10 weeks (1x/week)', tuition: 700 },
    'Writing (4-5)': { dayTime: 'Wed 6:30–7:50 PM', duration: '10 weeks (1x/week)', tuition: 700 },
    'Book Club (K-1)': { dayTime: 'Thu 4:30–5:30 PM', duration: '10 weeks (1x/week)', tuition: 600 },
    'Book Club (2-3)': { dayTime: 'Mon 6:30–7:30 PM', duration: '10 weeks (1x/week)', tuition: 600 },
    'Book Club (4-5)': { dayTime: 'Thu 6:30–7:30 PM', duration: '10 weeks (1x/week)', tuition: 600 },
    'Korean Speaking (3-5)': { dayTime: 'Wed 01:00–02:00 PM', duration: '10 weeks (1x/week)', tuition: 600 },
    'Hangul Foundations (K-2)': { dayTime: 'Sat 11:15 AM–12:15 PM', duration: '15 weeks (1x/week)', tuition: 1500 },
  };

  let subtotal = 0;
  const tableRows = programs.map(name => {
    const details = programDetails[name] || {};
    const tuition = details.tuition || 0;
    subtotal += tuition;
    return `<tr>
      <td>${name}</td>
      <td>${details.dayTime || '-'}</td>
      <td>${details.duration || '-'}</td>
      <td class="right">${tuition ? `$${tuition}` : '-'}</td>
    </tr>`;
  }).join('');

  // Example discount logic
  const discountRate = 0.15;
  const discount = subtotal * discountRate;
  const total = subtotal - discount;

  const invoiceHtml2 = `
    <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dotori School Registration Confirmation & Invoice</title>
    <style>
      body { margin:0; padding:0; background:#f6f6f6; -webkit-font-smoothing: antialiased; }
      .wrapper { width:100%; background:#f6f6f6; padding:24px 0; }
      .container { width:100%; max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); }
      .header { background:#2b5c34; color:#ffffff; padding:20px 24px; font-family:Arial, Helvetica, sans-serif; }
      .header h1 { margin:0; font-size:20px; }
      .sub { color:#cfe8d5; font-size:12px; margin-top:4px; }
      .content { padding:24px; font-family:Arial, Helvetica, sans-serif; color:#222; line-height:1.6; }
      .badge { display:inline-block; font-size:12px; padding:2px 8px; border-radius:999px; background:#eef7f0; color:#2b5c34; border:1px solid #d9ebde; }
      .info-row { margin:12px 0 0; font-size:14px; }
      .info-row b { display:inline-block; width:90px; color:#444; }
      .table { width:100%; border-collapse:collapse; margin-top:14px; }
      .table th { text-align:left; background:#f3f3f3; font-size:12px; color:#444; padding:10px; border-bottom:1px solid #e9e9e9; }
      .table td { font-size:14px; padding:10px; border-bottom:1px solid #eee; vertical-align:top; }
      .right { text-align:right; }
      .totals { margin-top:12px; border-top:2px solid #e3e3e3; padding-top:10px; }
      .totals .row { display:flex; justify-content:space-between; margin:6px 0; font-size:14px; }
      .totals .row strong { font-size:16px; }
      .note { background:#fffaf2; border:1px solid #ffedd5; padding:12px; border-radius:10px; font-size:13px; margin-top:16px; }
      .muted { color:#666; font-size:12px; }
      .footer { padding:16px 24px 28px; text-align:center; font-family:Arial, Helvetica, sans-serif; color:#6b7280; font-size:12px; }
      .btn { display:inline-block; padding:10px 16px; background:#2b5c34; color:#fff !important; text-decoration:none; border-radius:8px; margin-top:12px; }
    </style>
  </head>
  </body>
</html>
          <h1>Dotori School Registration</h1>
          <div class="sub">Confirmation & Invoice</div>
        </div>
        <div class="content">
          <div class="badge">Registered</div>

          <p style="margin-top:8px;">Dear <strong>${studentName}</strong> family,<br>
          Your registration has been successfully completed. Please review the details and payment summary below.</p>

          <div class="info-row"><b>Student</b> ${studentName} </div>
          <div class="info-row"><b>Parent</b> ${parentName} ${phone}</div>

          <table class="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Day/Time</th>
                <th>Duration</th>
                <th class="right">Tuition</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="totals">
            <div class="row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
            <div class="row"><span>Discount (Early Bird 15%)</span><span>− $${discount.toFixed(2)}</span></div>
            <div class="row"><strong>Total</strong><strong>$${total.toFixed(2)}</strong></div>
          </div>

          <div class="note">
            <strong>Payment Options</strong><br>
            • Check: Payable to “Dotori School”<br>
            • Zelle: payments@dotorischool.org (include student name in memo)<br>
            <span class="muted">※ Full refund available until the first class starts.</span>
          </div>

          <p class="muted" style="margin-top:14px;">
            Contact: info@dotorischool.org · (425) 000-0000<br>
            Address: 1234 NE 1st St, Bellevue, WA
          </p>

          <a class="btn" href="https://www.dotorischool.org" target="_blank" rel="noopener">Visit Dotori School Website</a>
        </div>
        <div class="footer">
          © 2025 Dotori School · All rights reserved.
        </div>
      </div>
    </div>
  </body>
</html>
  `

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `Dotori School <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Dotori School Registration Invoice for ${studentName}`,
      html: invoiceHtml2
    });

    // Optionally notify admin
    await transporter.sendMail({
      from: `Dotori School <${process.env.SMTP_USER}>`,
      to: 'info@dotorischool.org',
      subject: `New Registration: ${studentName}`,
      html: invoiceHtml
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error sending registration email:', err);
    res.status(500).json({ error: 'Failed to send registration email.' });
  }
};
