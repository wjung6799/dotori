import dbConnect from '@/lib/db';
import Order from '@/lib/models/Order';
import { getStripe } from '@/lib/stripe';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/admin/orders/:id/refund — refund the Stripe charge, mark refunded.
export async function POST(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    const order = await Order.findById(id);
    if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });
    if (!order.stripePaymentIntentId) {
      return Response.json({ error: 'No payment intent on this order.' }, { status: 400 });
    }

    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    await stripe.refunds.create({ charge: pi.latest_charge });

    await Order.findByIdAndUpdate(order._id, { paymentStatus: 'refunded' });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Refund error:', err);
    return Response.json({ error: err.message || 'Failed to process refund.' }, { status: 500 });
  }
}
