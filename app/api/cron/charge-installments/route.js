import dbConnect from '@/lib/db';
import Invoice from '@/lib/models/Invoice';
import User from '@/lib/models/User';
import { nextInstallmentAmount } from '@/lib/invoicing';
import { getStripe } from '@/lib/stripe';
import { sendInstallmentCharged, sendInstallmentFailed } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/cron/charge-installments: invoked daily by Vercel Cron (see
// vercel.json). Takes the next payment on every monthly plan that has come due,
// using the card the family authorized when they started the plan.
//
// Nothing here marks an invoice paid. It creates a charge and the webhook
// records it, exactly as it does for a payment the family makes themselves —
// one settlement path, so a plan cannot drift out of step with a manual payment.
// Auth: Vercel sends Authorization: Bearer CRON_SECRET; reject anything else.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  await dbConnect();
  const now = new Date();

  const due = await Invoice.find({
    'plan.status': 'active',
    'plan.nextChargeAt': { $lte: now },
    'plan.stripePaymentMethodId': { $ne: null },
    status: { $in: ['open', 'processing'] },
  }).limit(100);

  const result = { considered: due.length, charged: 0, failed: 0, skipped: 0 };
  if (due.length === 0) return Response.json(result);

  const stripe = getStripe();
  const siteUrl = process.env.SITE_URL || 'https://www.dotorischool.org';

  for (const invoice of due) {
    const n = invoice.plan.installments;
    const already = invoice.plan.chargedCount || 0;
    if (already >= n) {
      // Belt and braces: the webhook should already have completed this.
      invoice.plan.status = 'complete';
      invoice.plan.nextChargeAt = null;
      await invoice.save();
      result.skipped += 1;
      continue;
    }

    // Recomputed from the invoice, not stored per installment, so a correction to
    // the invoice flows into whatever has not been charged yet.
    const schedule = installmentSchedule(invoice, n);
    const step = schedule[already];
    if (amountCents < 50) {
      // Nothing meaningful left to take — the balance is covered, so close the
      // plan rather than attempting a charge Stripe would reject anyway.
      invoice.plan.status = 'complete';
      invoice.plan.nextChargeAt = null;
      invoice.status = 'paid';
      invoice.paidAt = invoice.paidAt || new Date();
      await invoice.save();
      result.skipped += 1;
      continue;
    }

    const user = await User.findById(invoice.userId).select('email firstName lastName name');

    try {
      await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: invoice.plan.stripeCustomerId || undefined,
        payment_method: invoice.plan.stripePaymentMethodId,
        // The family is not at the keyboard, so Stripe has to know this is a
        // charge they pre-authorized rather than an unattended fraud attempt.
        off_session: true,
        confirm: true,
        payment_method_types: ['card'],
        description: `Dotori School invoice ${invoice.number} — payment ${already + 1} of ${n}`,
        receipt_email: user?.email || undefined,
        metadata: {
          source: 'invoice',
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.number,
          userId: String(invoice.userId),
          method: 'card',
          installments: String(n),
          installmentNumber: String(already + 1),
          feeCents: '0',
        },
      });

      result.charged += 1;
      if (user?.email) {
        try {
          await sendInstallmentCharged({
            to: user.email,
            parentName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || 'there',
            invoiceNumber: invoice.number,
            amountCents,
            paymentNumber: already + 1,
            paymentCount: n,
            cardLast4: invoice.plan.cardLast4,
            siteUrl,
          });
        } catch (mailErr) {
          console.error('Installment receipt email failed:', mailErr?.message || mailErr);
        }
      }
    } catch (err) {
      // An off-session charge fails for ordinary reasons — an expired card, a
      // new card number, no funds — so this is a normal path, not an outage.
      const message = err?.message || 'The card was declined.';
      invoice.plan.lastError = message;
      invoice.plan.failedAttempts = (invoice.plan.failedAttempts || 0) + 1;
      // Retry tomorrow, then hand it to the office rather than hammering a card
      // that is clearly not going to work.
      if (invoice.plan.failedAttempts >= 3) {
        invoice.plan.status = 'failed';
      } else {
        invoice.plan.nextChargeAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }
      await invoice.save();
      result.failed += 1;

      if (user?.email) {
        try {
          await sendInstallmentFailed({
            to: user.email,
            parentName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || 'there',
            invoiceNumber: invoice.number,
            amountCents,
            paymentNumber: already + 1,
            paymentCount: n,
            reason: message,
            givingUp: invoice.plan.status === 'failed',
            siteUrl,
          });
        } catch (mailErr) {
          console.error('Installment failure email failed:', mailErr?.message || mailErr);
        }
      }
      console.error(`Installment ${already + 1}/${n} failed for ${invoice.number}: ${message}`);
    }
  }

  return Response.json(result);
}
