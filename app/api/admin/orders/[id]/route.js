import dbConnect from '@/lib/db';
import Order from '@/lib/models/Order';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/orders/:id
export async function GET(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    const order = await Order.findById(id);
    if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });
    return Response.json({ order });
  } catch (err) {
    console.error('Admin order fetch error:', err);
    return Response.json({ error: 'Failed to fetch order.' }, { status: 500 });
  }
}

// PUT /api/admin/orders/:id: update tracking, notes, fulfillment status
export async function PUT(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    const body = (await request.json()) || {};
    const { trackingNumber, trackingUrl, carrier, fulfillmentStatus, notes, shippedAt } = body;
    const update = {};
    if (trackingNumber !== undefined) update.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) update.trackingUrl = trackingUrl;
    if (carrier !== undefined) update.carrier = carrier;
    if (fulfillmentStatus !== undefined) update.fulfillmentStatus = fulfillmentStatus;
    if (notes !== undefined) update.notes = notes;
    if (trackingNumber && !shippedAt) update.shippedAt = new Date();

    await dbConnect();
    const order = await Order.findByIdAndUpdate(id, update, { new: true });
    return Response.json({ ok: true, order });
  } catch (err) {
    console.error('Admin order update error:', err);
    return Response.json({ error: 'Failed to update order.' }, { status: 500 });
  }
}
