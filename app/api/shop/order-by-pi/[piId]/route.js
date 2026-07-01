import dbConnect from '@/lib/db';
import Order from '@/lib/models/Order';
import { publicOrderView } from '@/lib/shop';

export const dynamic = 'force-dynamic';

// GET /api/shop/order-by-pi/:piId — for the order-confirmation page redirect.
export async function GET(request, { params }) {
  try {
    const { piId } = await params;
    await dbConnect();
    const order = await Order.findOne({ stripePaymentIntentId: piId });
    if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });
    return Response.json({ order: publicOrderView(order) });
  } catch (err) {
    console.error('Order by-pi error:', err);
    return Response.json({ error: 'Failed to fetch order.' }, { status: 500 });
  }
}
