import dbConnect from '@/lib/db';
import Order from '@/lib/models/Order';
import { publicOrderView } from '@/lib/shop';

export const dynamic = 'force-dynamic';

// GET /api/shop/order-status/:token
export async function GET(request, { params }) {
  try {
    const { token } = await params;
    await dbConnect();
    const order = await Order.findOne({ lookupToken: token });
    if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });
    return Response.json({ order: publicOrderView(order) });
  } catch (err) {
    console.error('Order status error:', err);
    return Response.json({ error: 'Failed to fetch order.' }, { status: 500 });
  }
}
