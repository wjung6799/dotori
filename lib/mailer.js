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

// Escape user-supplied values before interpolating them into email HTML. Names,
// subjects, etc. can originate from unauthenticated input (the public diagnostic
// route), so this prevents HTML/link injection into recipients' inboxes.
function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

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
  const profileUrl = `${siteUrl}/dashboard`;
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


// A family has been billed. This is the only nudge they get that money is owed,
// so it carries the line items, the total and a direct link into the portal
// where they settle it. A fee line only appears if one was actually charged.
export async function sendInvoiceIssued({
  to,
  parentName,
  studentName,
  invoiceNumber,
  summary,
  items = [],
  subtotalCents,
  cardTotalCents,
  dueAt,
  siteUrl,
}) {
  const money = (c) =>
    '$' + ((c || 0) / 100).toLocaleString('en-US', {
      minimumFractionDigits: (c || 0) % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  const payUrl = `${siteUrl}/dashboard/billing`;
  const due = dueAt
    ? new Date(dueAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const feeCents = (cardTotalCents || 0) - (subtotalCents || 0);

  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ede8">${esc(i.description)}${
          i.detail ? `<div style="color:#9b8b77;font-size:12px">${esc(i.detail)}</div>` : ''
        }</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ede8;text-align:right;white-space:nowrap">${money(i.amountCents)}</td>
      </tr>`,
    )
    .join('');

  await deliver({
    to,
    subject: `Invoice ${invoiceNumber} from Dotori School${studentName ? ` — ${studentName}` : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#8b7355">Dotori School</h2>
        <p>Hi ${esc(parentName)},</p>
        <p>
          Here is invoice <strong>${esc(invoiceNumber)}</strong>${
            studentName ? ` for <strong>${esc(studentName)}</strong>` : ''
          }${summary ? ` — ${esc(summary)}` : ''}.
        </p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px">
          ${rows}
          <tr>
            <td style="padding:10px 12px;font-weight:bold">Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:bold;font-size:16px">${money(subtotalCents)}</td>
          </tr>
        </table>
        ${
          feeCents > 0
            ? `<p style="font-size:13px;color:#9b8b77">Pay by bank transfer in the portal at no extra cost. Paying by card adds a ${money(feeCents)} processing fee (${money(cardTotalCents)} by card).</p>`
            : ''
        }
        ${due ? `<p style="color:#6b5b47">Due <strong>${esc(due)}</strong>.</p>` : ''}
        <p>
          <a href="${payUrl}"
             style="display:inline-block;padding:10px 20px;background:#8b7355;color:#fff;text-decoration:none;border-radius:6px">
            View and pay the invoice
          </a>
        </p>
        <p style="font-size:13px;color:#888">
          Prefer to pay by Zelle or check? Just reply to this email and we will record it.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}


const usd = (c) =>
  '$' + ((c || 0) / 100).toLocaleString('en-US', {
    minimumFractionDigits: (c || 0) % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

// Someone asked to reset their password. The link is single-use and expires,
// and the email says so — plus what to do if they never asked.
export async function sendPasswordReset({ to, parentName, resetUrl }) {
  await deliver({
    to,
    subject: 'Reset your Dotori School password',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#8b7355">Dotori School</h2>
        <p>Hi ${esc(parentName)},</p>
        <p>Someone asked to reset the password for this account. If that was you, the link below
        sets a new one. It works once and expires in an hour.</p>
        <p><a href="${resetUrl}"
             style="display:inline-block;padding:10px 20px;background:#8b7355;color:#fff;text-decoration:none;border-radius:6px">
            Set a new password
          </a></p>
        <p style="font-size:13px;color:#888">If you did not ask for this, you can ignore this
        email — your password has not changed, and the link dies on its own.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}

// The password actually changed. Sent because an account change the owner did
// not make should never be something they find out about later.
export async function sendPasswordChanged({ to, parentName, siteUrl }) {
  await deliver({
    to,
    subject: 'Your Dotori School password was changed',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#8b7355">Dotori School</h2>
        <p>Hi ${esc(parentName)},</p>
        <p>Your account password was just changed. If this was you, you are all set.</p>
        <p>If it was not you, reply to this email right away and we will secure the account
        together.</p>
        <p><a href="${siteUrl}/login"
             style="display:inline-block;padding:10px 20px;background:#8b7355;color:#fff;text-decoration:none;border-radius:6px">
            Log in
          </a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}

// A bank transfer against an invoice bounced days after the family walked away
// believing it was paid. The invoice has already reopened in the portal; this
// is how they find out without stumbling onto it.
export async function sendInvoicePaymentFailed({ to, parentName, invoiceNumber, amountCents, reason, siteUrl }) {
  await deliver({
    to,
    subject: `Your bank transfer for invoice ${invoiceNumber} did not go through`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#8b7355">Dotori School</h2>
        <p>Hi ${esc(parentName)},</p>
        <p>
          The <strong>${usd(amountCents)}</strong> bank transfer for invoice
          <strong>${esc(invoiceNumber)}</strong> was returned by your bank, so the invoice is open
          again and nothing was charged.
        </p>
        ${reason ? `<p style="color:#a3261a">${esc(reason)}</p>` : ''}
        <p>You can settle it any time — by bank transfer, by card, or by Zelle or check.</p>
        <p><a href="${siteUrl}/dashboard/billing"
             style="display:inline-block;padding:10px 20px;background:#8b7355;color:#fff;text-decoration:none;border-radius:6px">
            See your billing
          </a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}

// An online credit-pack purchase failed AFTER the family walked away believing
// it was done — which only happens with bank transfers, since a card declines
// on the spot. Without this email a bounced ACH purchase simply vanishes: no
// credits, no record, and nothing on the page to say why.
export async function sendCreditPurchaseFailed({ to, parentName, packName, amountCents, reason, siteUrl }) {
  await deliver({
    to,
    subject: `Your payment for ${packName} did not go through`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#8b7355">Dotori School</h2>
        <p>Hi ${esc(parentName)},</p>
        <p>
          The <strong>${usd(amountCents)}</strong> bank transfer for
          <strong>${esc(packName)}</strong> could not be completed, so no sessions were added and
          nothing was charged.
        </p>
        ${reason ? `<p style="color:#a3261a">${esc(reason)}</p>` : ''}
        <p>You can try again any time — by bank transfer or by card.</p>
        <p><a href="${siteUrl}/dashboard/credits"
             style="display:inline-block;padding:10px 20px;background:#8b7355;color:#fff;text-decoration:none;border-radius:6px">
            Buy sessions
          </a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}

// Sessions a family paid for are about to lapse. Sent because an expiry nobody
// warned you about is a trap, and the pricing FAQ promises the opposite.
export async function sendCreditsExpiring({
  to, parentName, sessions, tutorName, expiresAt, daysLeft, siteUrl,
}) {
  const when = new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const withWho = tutorName ? ` with ${esc(tutorName)}` : '';
  await deliver({
    to,
    subject:
      daysLeft <= 7
        ? `Last week to use your ${sessions} session${sessions === 1 ? '' : 's'}`
        : `Your ${sessions} session${sessions === 1 ? '' : 's'} expire on ${when}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#8b7355">Dotori School</h2>
        <p>Hi ${esc(parentName)},</p>
        <p>
          You have <strong>${sessions} session${sessions === 1 ? '' : 's'}</strong>${withWho}
          left, and they need to be used by <strong>${esc(when)}</strong> —
          ${daysLeft <= 7 ? 'that is less than a week away' : `about ${daysLeft} days from now`}.
        </p>
        <p>
          <a href="${siteUrl}/dashboard/booking"
             style="display:inline-block;padding:10px 20px;background:#8b7355;color:#fff;text-decoration:none;border-radius:6px">
            Book a session
          </a>
        </p>
        <p style="font-size:13px;color:#888">
          If the timing does not work, just reply — we extend once as a courtesy, and we would far
          rather keep your child learning than watch a package lapse.
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
  const profileUrl = `${siteUrl}/dashboard`;
  await deliver({
    to,
    subject: `Session booked – ${studentName} with ${tutorName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>Hi ${esc(parentName) || 'there'},</p>
        <p>Your tutoring session is confirmed:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;width:35%">Student</td>
            <td style="padding:8px 12px">${esc(studentName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">Instructor</td>
            <td style="padding:8px 12px">${esc(tutorName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">When</td>
            <td style="padding:8px 12px">${esc(whenLabel)}</td>
          </tr>${
            subject
              ? `
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">Subject</td>
            <td style="padding:8px 12px">${esc(subject)}</td>
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

// Sent to the family when the school cancels a booking (admin cancel button).
export async function sendBookingCancellation({
  to,
  studentName,
  tutorName,
  whenLabel,
  subject,
}) {
  await deliver({
    to,
    subject: `Cancelled – ${studentName}'s ${subject || 'session'} on ${whenLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>The following appointment has been <strong>cancelled</strong>:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;width:35%">Student</td>
            <td style="padding:8px 12px">${esc(studentName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">Instructor</td>
            <td style="padding:8px 12px">${esc(tutorName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">When</td>
            <td style="padding:8px 12px">${esc(whenLabel)}</td>
          </tr>${
            subject
              ? `
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">Subject</td>
            <td style="padding:8px 12px">${esc(subject)}</td>
          </tr>`
              : ''
          }
        </table>
        <p>Questions? Just reply to this email or write to info@dotorischool.org.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Reply to this email if you have questions.</p>
      </div>
    `,
  });
}

export async function sendTutorBookingAlert({
  to,
  tutorName,
  studentName,
  parentName,
  whenLabel,
  subject,
  siteUrl,
}) {
  const dashUrl = `${siteUrl}/tutor`;
  await deliver({
    to,
    subject: `New booking – ${studentName} on ${whenLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>Hi ${esc(tutorName) || 'there'},</p>
        <p>A family just booked a session with you:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;width:35%">Student</td>
            <td style="padding:8px 12px">${esc(studentName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">Family</td>
            <td style="padding:8px 12px">${esc(parentName)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">When</td>
            <td style="padding:8px 12px">${esc(whenLabel)}</td>
          </tr>${
            subject
              ? `
          <tr>
            <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold">Subject</td>
            <td style="padding:8px 12px">${esc(subject)}</td>
          </tr>`
              : ''
          }
        </table>
        <p>
          <a href="${dashUrl}"
             style="display:inline-block;padding:10px 20px;background:#5b8a4a;color:#fff;text-decoration:none;border-radius:4px">
            View in Dashboard
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Automated notification.</p>
      </div>
    `,
  });
}

// A family asked for a free diagnostic via the /diagnostic message form → alert
// the school so they can reach out and schedule. All user-supplied fields are
// escaped (this is fed by an unauthenticated public form).
export async function sendDiagnosticRequestAlert({
  to,
  parentName,
  email,
  phone,
  studentName,
  track,
  message,
}) {
  const row = (label, value) =>
    value
      ? `<tr>
           <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;width:35%">${label}</td>
           <td style="padding:8px 12px">${esc(value)}</td>
         </tr>`
      : '';
  await deliver({
    to,
    subject: `Free Diagnostic Request – ${parentName}${studentName ? ` (${studentName})` : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>A family requested a <strong>free diagnostic assessment</strong>:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          ${row('Parent', parentName)}
          ${row('Email', email)}
          ${row('Phone', phone)}
          ${row('Student', studentName)}
          ${row('Track', track)}
        </table>
        ${
          message
            ? `<p style="margin:16px 0 6px"><strong>Message</strong></p>
               <p style="background:#f9f9f9;border-left:4px solid #5b8a4a;padding:12px 16px;border-radius:4px;white-space:pre-wrap">${esc(message)}</p>`
            : ''
        }
        <p style="font-size:13px;color:#888">Reach out to ${esc(email)} to schedule their assessment.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · Submitted from the website diagnostic form.</p>
      </div>
    `,
  });
}

// Parent-facing confirmation that their diagnostic request was received. This
// goes to an UNVERIFIED submitted address, so the greeting must not carry
// attacker-controlled linkable text; reduce parentName to a letters-only first
// name (no dots/slashes → nothing a mail client will auto-linkify).
export async function sendDiagnosticRequestConfirmation({ to, parentName }) {
  const safeFirst = String(parentName || '')
    .split(/\s+/)[0]
    .replace(/[^\p{L}'-]/gu, '')
    .slice(0, 40);
  await deliver({
    to,
    subject: `We got your request – Dotori School`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>Hi ${esc(safeFirst) || 'there'},</p>
        <p>Thanks for reaching out! We've received your request for a <strong>free diagnostic assessment</strong> and will contact you within one business day to find a time that works.</p>
        <p>There's nothing to prepare, and no obligation.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:12px;color:#aaa">Dotori School · 12721 NE Bel-Red Rd #220, Bellevue WA 98005 · Reply to this email with any questions.</p>
      </div>
    `,
  });
}

// Weekly heads-up for a standing recurring booking: newly booked sessions,
// any weeks we had to skip (full / not offered), and a paused note when the
// family has run out of sessions. Sent by the book route (on setup) and the
// book-recurring cron (as the window rolls forward).
export async function sendRecurringUpdate({
  to,
  parentName,
  studentName,
  tutorName,
  weeklyLabel,
  booked = [],
  skipped = [],
  paused = false,
  siteUrl,
}) {
  const scheduleUrl = `${siteUrl}/dashboard/booking`;

  const bookedHtml = booked.length
    ? `<p style="margin:16px 0 6px"><strong>Booked for ${studentName}:</strong></p>
       <ul style="margin:0 0 8px;padding-left:20px;color:#333">
         ${booked.map((b) => `<li style="padding:2px 0">${b.label}</li>`).join('')}
       </ul>`
    : '';

  const skippedHtml = skipped.length
    ? `<p style="margin:16px 0 6px"><strong>Couldn't book these weeks:</strong></p>
       <ul style="margin:0 0 8px;padding-left:20px;color:#a3261a">
         ${skipped
           .map(
             (s) =>
               `<li style="padding:2px 0">${s.label}: ${
                 s.reason === 'full' ? 'that session filled up' : 'not offered that week'
               }. <a href="${scheduleUrl}" style="color:#5b8a4a">Pick another day →</a></li>`,
           )
           .join('')}
       </ul>`
    : '';

  const pausedHtml = paused
    ? `<p style="background:#fdf3ec;border-left:4px solid #e8a87c;padding:12px 16px;border-radius:4px;margin:16px 0">
         Your weekly booking is <strong>paused</strong> because you're out of sessions. Add sessions to your
         account (Zelle) and it will automatically resume from where it left off.
       </p>`
    : '';

  await deliver({
    to,
    subject: paused
      ? `Weekly booking paused – ${studentName}`
      : `Your weekly sessions – ${studentName} with ${tutorName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#5b8a4a">Dotori School</h2>
        <p>Hi ${parentName || 'there'},</p>
        <p>Here's the latest on ${studentName}'s standing weekly session${
          weeklyLabel ? ` (<strong>${weeklyLabel}</strong>)` : ''
        } with ${tutorName}:</p>
        ${bookedHtml}
        ${skippedHtml}
        ${pausedHtml}
        <p style="margin-top:16px">
          <a href="${scheduleUrl}"
             style="display:inline-block;padding:10px 20px;background:#5b8a4a;color:#fff;text-decoration:none;border-radius:4px">
            Manage My Sessions
          </a>
        </p>
        <p style="font-size:13px;color:#888">
          You can cancel a single week or the whole weekly booking anytime from your schedule page.
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
        <p>Great news: your order is on its way! 📦</p>
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
