import crypto from 'crypto';
import dbConnect from '@/lib/db';
import Order from '@/lib/models/Order';
import { sendShippingNotification } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/shop/printful-webhook — Printful package_shipped notifications.
export async function POST(request) {
  try {
    const signature = request.headers.get('x-printful-signature');
    const secret = process.env.PRINTFUL_WEBHOOK_SECRET;
    const rawBody = await request.text();

    if (secret) {
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (signature !== expected) {
        return new Response('Invalid signature', { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);

    if (event.type === 'package_shipped') {
      const printfulOrderId = event.data?.order?.id;
      const shipment = event.data?.shipment || {};

      if (!printfulOrderId) return Response.json({ ok: true });

      await dbConnect();
      const order = await Order.findOneAndUpdate(
        { printfulOrderId },
        {
          trackingNumber: shipment.tracking_number || '',
          trackingUrl: shipment.tracking_url || '',
          carrier: shipment.carrier || '',
          shippedAt: new Date(),
          printfulStatus: 'fulfilled',
          fulfillmentStatus: 'fulfilled',
        },
        { new: true },
      );

      if (order && !order.shippingEmailSent) {
        try {
          const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
          await sendShippingNotification({
            to: order.email,
            firstName: order.firstName,
            order,
            siteUrl,
          });
          await Order.findByIdAndUpdate(order._id, { shippingEmailSent: true });
        } catch (mailErr) {
          console.error('Shipping notification email failed:', mailErr.message);
        }
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Printful webhook error:', err);
    return Response.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
