import crypto from 'crypto';
import dbConnect from '@/lib/db';
import Product from '@/lib/models/Product';
import Order from '@/lib/models/Order';
import { getStripe } from '@/lib/stripe';
import { calcShipping } from '@/lib/shop';

export const dynamic = 'force-dynamic';

// POST /api/shop/create-payment-intent: validate cart, create Order + Stripe PI.
export async function POST(request) {
  try {
    const { items, guest, calculationId, taxAmount } = (await request.json()) || {};
    const { email, firstName, lastName, phone, address } = guest || {};

    if (!email || !firstName || !lastName) {
      return Response.json({ error: 'Name and email are required.' }, { status: 400 });
    }
    if (!address || !address.line1 || !address.city || !address.state || !address.zip) {
      return Response.json({ error: 'Complete shipping address is required.' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return Response.json({ error: 'Cart is empty.' }, { status: 400 });
    }

    await dbConnect();

    // Validate items against DB and build snapshot
    const orderItems = [];
    let subtotal = 0;
    for (const cartItem of items) {
      const product = await Product.findById(cartItem.productId);
      if (!product || !product.active) {
        return Response.json(
          { error: `Product not found: ${cartItem.productName || cartItem.productId}` },
          { status: 400 },
        );
      }
      const variant = product.variants[cartItem.variantIndex];
      if (!variant) {
        return Response.json({ error: `Variant not found for ${product.name}` }, { status: 400 });
      }
      const qty = Math.max(1, Math.min(10, parseInt(cartItem.qty) || 1));
      orderItems.push({
        productId: product._id,
        productName: product.name,
        variantLabel: variant.label,
        quantity: qty,
        unitPrice: variant.price,
        fulfiller: product.fulfiller,
        printfulVariantId: variant.printfulVariantId || null,
        luluProductId: variant.luluProductId || '',
      });
      subtotal += variant.price * qty;
    }

    const shippingCost = calcShipping(subtotal);
    const tax = parseFloat(taxAmount) || 0;
    const total = subtotal + shippingCost + tax;
    const lookupToken = crypto.randomBytes(20).toString('hex');

    const order = new Order({
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: (phone || '').trim(),
      address: {
        line1: address.line1.trim(),
        line2: (address.line2 || '').trim(),
        city: address.city.trim(),
        state: address.state.trim().toUpperCase(),
        zip: address.zip.trim(),
        country: (address.country || 'US').trim(),
      },
      items: orderItems,
      subtotal,
      shippingCost,
      taxAmount: tax,
      total,
      stripeTaxCalculationId: calculationId || '',
      lookupToken,
    });
    await order.save();

    const stripe = getStripe();
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'usd',
      metadata: { orderId: order._id.toString(), source: 'shop', lookupToken },
      automatic_payment_methods: { enabled: true },
    });

    order.stripePaymentIntentId = pi.id;
    await order.save();

    return Response.json({ clientSecret: pi.client_secret, lookupToken, orderId: order._id });
  } catch (err) {
    console.error('Create payment intent error:', err);
    return Response.json({ error: 'Failed to create order.' }, { status: 500 });
  }
}
