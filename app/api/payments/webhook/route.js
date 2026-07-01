import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import Order from '@/lib/models/Order';
import { getStripe } from '@/lib/stripe';
import { sendOrderConfirmation } from '@/lib/mailer';
import { createPrintfulOrder } from '@/lib/printful';
import { createLuluJob } from '@/lib/luluClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/payments/webhook — Stripe webhook. Uses the raw request body so the
// signature verifies (Next does not parse the body for us here).
export async function POST(request) {
  const stripe = getStripe();
  const sig = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    try {
      await dbConnect();
      if (pi.metadata && pi.metadata.source === 'shop') {
        await handleShopPayment(pi, stripe);
      } else {
        await Enrollment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { paymentStatus: 'paid', paidAt: new Date() },
        );
        console.log(`Enrollment payment confirmed for intent ${pi.id}`);
      }
    } catch (err) {
      console.error('Payment processing error:', err);
    }
  }

  return Response.json({ received: true });
}

async function handleShopPayment(pi, stripe) {
  const order = await Order.findOneAndUpdate(
    { stripePaymentIntentId: pi.id },
    { paymentStatus: 'paid', paidAt: new Date() },
    { new: true },
  );
  if (!order) {
    console.error('Shop order not found for intent:', pi.id);
    return;
  }
  console.log(`Shop order ${order._id} payment confirmed.`);

  // Order confirmation email
  try {
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    await sendOrderConfirmation({ to: order.email, firstName: order.firstName, order, siteUrl });
  } catch (mailErr) {
    console.error('Order confirmation email failed:', mailErr.message);
  }

  // Record Stripe Tax transaction for audit trail
  if (order.stripeTaxCalculationId) {
    try {
      await stripe.tax.transactions.createFromCalculation({
        calculation: order.stripeTaxCalculationId,
        reference: order._id.toString(),
      });
    } catch (taxErr) {
      console.error('Stripe Tax transaction creation failed:', taxErr.message);
    }
  }

  // Fulfill Printful items (idempotent)
  const hasPrintful = order.items.some((i) => i.fulfiller === 'printful');
  if (hasPrintful && !order.printfulOrderId) {
    await createPrintfulOrder(order);
  }

  // Fulfill Lulu items
  const hasLulu = order.items.some((i) => i.fulfiller === 'lulu');
  if (hasLulu && !order.luluJobId) {
    try {
      await createLuluJob(order);
    } catch (luluErr) {
      console.error('Lulu job creation error:', luluErr.message);
      await Order.findByIdAndUpdate(order._id, { fulfillmentStatus: 'error' });
    }
  }

  // Update fulfillment status
  if (hasPrintful || hasLulu) {
    const updated = await Order.findById(order._id);
    if (updated && updated.fulfillmentStatus === 'unfulfilled') {
      await Order.findByIdAndUpdate(order._id, { fulfillmentStatus: 'partial' });
    }
  }
}
