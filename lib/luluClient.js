import Order from '@/lib/models/Order';
import { sendShippingNotification } from '@/lib/mailer';

// Token cache lives on the warm function instance (per-region). Refreshed when
// expired; harmless to re-fetch on a cold start.
let _token = null;
let _expiry = 0;

export async function getLuluToken() {
  if (_token && Date.now() < _expiry - 60000) return _token;
  const res = await fetch(
    'https://api.lulu.com/auth/realms/glasstree/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.LULU_CLIENT_KEY,
        client_secret: process.env.LULU_CLIENT_SECRET,
      }),
    },
  );
  if (!res.ok) throw new Error(`Lulu auth failed: ${res.status}`);
  const data = await res.json();
  _token = data.access_token;
  _expiry = Date.now() + data.expires_in * 1000;
  return _token;
}

export async function createLuluJob(order) {
  const luluItems = order.items.filter((i) => i.fulfiller === 'lulu');
  if (luluItems.length === 0) return;

  const token = await getLuluToken();
  const baseUrl = process.env.LULU_PDF_BASE_URL || '';

  const body = {
    contact_email: order.email,
    line_items: luluItems.map((i) => ({
      title: i.productName,
      cover: { source_url: `${baseUrl}/${i.luluProductId}/cover.pdf` },
      interior: { source_url: `${baseUrl}/${i.luluProductId}/interior.pdf` },
      pod_package_id: i.luluProductId,
      quantity: i.quantity,
    })),
    shipping_address: {
      name: `${order.firstName} ${order.lastName}`,
      street1: order.address.line1,
      street2: order.address.line2 || '',
      city: order.address.city,
      state_code: order.address.state,
      postcode: order.address.zip,
      country_code: order.address.country || 'US',
      phone_number: order.phone || '',
      email: order.email,
    },
    shipping_level: 'MAIL',
  };

  const res = await fetch('https://api.lulu.com/print-jobs/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (res.ok) {
    await Order.findByIdAndUpdate(order._id, {
      luluJobId: String(data.id),
      luluStatus: data.status?.name || '',
    });
    console.log(`Lulu job created for order ${order._id}: job ${data.id}`);
  } else {
    console.error('Lulu job creation failed:', JSON.stringify(data));
    await Order.findByIdAndUpdate(order._id, { fulfillmentStatus: 'error' });
  }
}

// Poll open Lulu jobs for shipping status. Invoked by the Vercel Cron route
// (app/api/cron/poll-lulu); replaces the Express setInterval poller.
export async function pollLuluOrders() {
  try {
    const orders = await Order.find({
      luluJobId: { $ne: '' },
      fulfillmentStatus: { $nin: ['fulfilled'] },
      paymentStatus: 'paid',
    });

    for (const order of orders) {
      try {
        const token = await getLuluToken();
        const res = await fetch(`https://api.lulu.com/print-jobs/${order.luluJobId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const data = await res.json();

        const statusName = data.status?.name || '';
        const trackingNum = data.line_items?.[0]?.tracking_id || '';
        const trackingUrl = data.line_items?.[0]?.tracking_url || '';

        const update = { luluStatus: statusName };
        if (statusName === 'SHIPPED') {
          update.trackingNumber = trackingNum;
          update.trackingUrl = trackingUrl;
          update.shippedAt = new Date();
          update.fulfillmentStatus = 'fulfilled';
        }
        await Order.findByIdAndUpdate(order._id, update);

        if (statusName === 'SHIPPED' && !order.shippingEmailSent) {
          const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
          await sendShippingNotification({
            to: order.email,
            firstName: order.firstName,
            order: { ...order.toObject(), ...update },
            siteUrl,
          });
          await Order.findByIdAndUpdate(order._id, { shippingEmailSent: true });
        }
      } catch (err) {
        console.error(`Lulu poll error for order ${order._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('pollLuluOrders error:', err.message);
  }
}
