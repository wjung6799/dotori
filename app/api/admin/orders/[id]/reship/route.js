import dbConnect from '@/lib/db';
import Order from '@/lib/models/Order';
import { createLuluJob } from '@/lib/luluClient';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/admin/orders/:id/reship: re-trigger Lulu fulfillment.
// (Printful re-ship is still done manually in the Printful dashboard.)
export async function POST(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    const order = await Order.findById(id);
    if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });

    const hasLulu = order.items.some((i) => i.fulfiller === 'lulu');

    // Reset IDs so createLuluJob re-triggers
    await Order.findByIdAndUpdate(order._id, {
      printfulOrderId: null,
      luluJobId: '',
      fulfillmentStatus: 'unfulfilled',
    });
    const freshOrder = await Order.findById(order._id);

    if (hasLulu) {
      await createLuluJob(freshOrder);
    }

    return Response.json({ ok: true, message: 'Re-ship triggered.' });
  } catch (err) {
    console.error('Reship error:', err);
    return Response.json({ error: 'Failed to trigger re-ship.' }, { status: 500 });
  }
}
