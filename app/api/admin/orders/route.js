import dbConnect from '@/lib/db';
import Order from '@/lib/models/Order';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/orders — optional ?status= and ?fulfillment= filters
export async function GET(request) {
  if (!(await getAdminUser())) return forbidden();
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const filter = {};
    if (searchParams.get('status')) filter.paymentStatus = searchParams.get('status');
    if (searchParams.get('fulfillment')) filter.fulfillmentStatus = searchParams.get('fulfillment');
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    return Response.json({ orders });
  } catch (err) {
    console.error('Admin orders fetch error:', err);
    return Response.json({ error: 'Failed to fetch orders.' }, { status: 500 });
  }
}
