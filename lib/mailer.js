import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Email delivery. Prefer Resend (lets us send from a verified custom-domain
// address like noreply@dotorischool.org) when RESEND_API_KEY is set; otherwise
// fall back to SMTP (Gmail). Callers wrap sends in try/catch, so a missing/broken
// config never breaks the surrounding flow.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false', // true by default
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Resend sends from the verified domain; Gmail SMTP must send from the
// authenticated account (it rejects a mismatched From), so pick accordingly.
const FROM = resend
  ? process.env.EMAIL_FROM || 'Dotori School <noreply@dotorischool.org>'
  : `Dotori School <${process.env.SMTP_USER}>`;

// Unified sender used by all templates below.
async function deliver({ to, subject, html }) {
  if (resend) {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message || 'Resend send failed');
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html });
}

export async function sendReportNotification({ to, parentName, studentName, title, quarter, siteUrl }) {
  const profileUrl = `${siteUrl}/profile`;
  await deliver({
    to,
    subject: `New Report Card Available – ${studentName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>Hi ${parentName},</p>
        <p>A new report card has been uploaded for <strong>${studentName}</strong>:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;width:35%">Report</td>
            <td style="padding:8px 12px">${title}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">Quarter</td>
            <td style="padding:8px 12px">${quarter}</td>
          </tr>
        </table>
        <p>
          <a href="${profileUrl}"
             style="display:inline-block;padding:10px 20px;background:#5b8a4a;color:#fff;text-decoration:none;border-radius:4px">
            View Report Card
          </a>
        </p>
        <p style="font-size:13px;color:#888">
          Log in to your account and go to the <em>Report Cards</em> tab to download the PDF.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}

export async function sendBookingConfirmation({
  to,
  parentName,
  studentName,
  tutorName,
  whenLabel,
  subject,
  siteUrl,
}) {
  const profileUrl = `${siteUrl}/profile`;
  await deliver({
    to,
    subject: `Session booked – ${studentName} with ${tutorName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>Hi ${parentName || 'there'},</p>
        <p>Your tutoring session is confirmed:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;width:35%">Student</td>
            <td style="padding:8px 12px">${studentName}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">Tutor</td>
            <td style="padding:8px 12px">${tutorName}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">When</td>
            <td style="padding:8px 12px">${whenLabel}</td>
          </tr>${
            subject
              ? `
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">Subject</td>
            <td style="padding:8px 12px">${subject}</td>
          </tr>`
              : ''
          }
        </table>
        <p>
          <a href="${profileUrl}"
             style="display:inline-block;padding:10px 20px;background:#5b8a4a;color:#fff;text-decoration:none;border-radius:4px">
            View My Sessions
          </a>
        </p>
        <p style="font-size:13px;color:#888">
          Need to cancel? Cancellations made at least 12 hours before the session are refunded a session credit; cancellations within 12 hours are not refundable.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}

export async function sendOrderConfirmation({ to, firstName, order, siteUrl }) {
  const statusUrl = `${siteUrl}/order-status?token=${order.lookupToken}`;
  const orderId = order.lookupToken.slice(0, 8).toUpperCase();

  const itemsHtml = order.items
    .map(
      (i) =>
        `<tr>
       <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${i.productName}${i.variantLabel ? ' – ' + i.variantLabel : ''}</td>
       <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f0f0f0">${i.quantity}</td>
       <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #f0f0f0">$${(i.unitPrice * i.quantity).toFixed(2)}</td>
     </tr>`,
    )
    .join('');

  await deliver({
    to,
    subject: `Order Confirmed – Dotori School (#${orderId})`,
    html: `
      <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>Hi ${firstName},</p>
        <p>Thank you for your order! We've received your payment and your order is being prepared.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #eee;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;text-align:left;font-weight:600">Item</th>
              <th style="padding:8px 12px;text-align:center;font-weight:600">Qty</th>
              <th style="padding:8px 12px;text-align:right;font-weight:600">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr><td colspan="2" style="padding:8px 12px;text-align:right;color:#888">Subtotal</td>
                <td style="padding:8px 12px;text-align:right">$${order.subtotal.toFixed(2)}</td></tr>
            <tr><td colspan="2" style="padding:8px 12px;text-align:right;color:#888">Shipping</td>
                <td style="padding:8px 12px;text-align:right">${order.shippingCost === 0 ? 'Free' : '$' + order.shippingCost.toFixed(2)}</td></tr>
            <tr><td colspan="2" style="padding:8px 12px;text-align:right;color:#888">Tax</td>
                <td style="padding:8px 12px;text-align:right">$${(order.taxAmount || 0).toFixed(2)}</td></tr>
            <tr style="font-weight:700;background:#f9f9f9">
              <td colspan="2" style="padding:10px 12px;text-align:right">Total</td>
              <td style="padding:10px 12px;text-align:right">$${order.total.toFixed(2)}</td></tr>
          </tfoot>
        </table>
        <p><strong>Shipping to:</strong><br>
          ${order.firstName} ${order.lastName}<br>
          ${order.address.line1}${order.address.line2 ? ', ' + order.address.line2 : ''}<br>
          ${order.address.city}, ${order.address.state} ${order.address.zip}
        </p>
        <p>
          <a href="${statusUrl}"
             style="display:inline-block;padding:10px 20px;background:#5b8a4a;color:#fff;text-decoration:none;border-radius:4px">
            Track Your Order
          </a>
        </p>
        <p style="font-size:13px;color:#888">
          You'll receive another email when your order ships with tracking information.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}

export async function sendShippingNotification({ to, firstName, order, siteUrl }) {
  const statusUrl = `${siteUrl}/order-status?token=${order.lookupToken}`;
  const trackingSection = order.trackingNumber
    ? `<p style="background:#f0f7ef;border-left:4px solid #5b8a4a;padding:12px 16px;border-radius:4px">
         <strong>Tracking Number:</strong> ${order.trackingNumber}${order.carrier ? ' (' + order.carrier + ')' : ''}<br>
         ${
           order.trackingUrl
             ? `<a href="${order.trackingUrl}" style="color:#5b8a4a;font-weight:600">Track your package →</a>`
             : ''
         }
       </p>`
    : '<p>Tracking information will be available shortly.</p>';

  await deliver({
    to,
    subject: `Your Dotori School Order Has Shipped!`,
    html: `
      <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>Hi ${firstName},</p>
        <p>Great news — your order is on its way! 📦</p>
        ${trackingSection}
        <p>
          <a href="${statusUrl}"
             style="display:inline-block;padding:10px 20px;background:#5b8a4a;color:#fff;text-decoration:none;border-radius:4px">
            View Order Status
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}
