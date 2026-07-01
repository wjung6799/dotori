import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/shop/tax-estimate — Stripe Tax calculation for the cart + address.
export async function POST(request) {
  try {
    const { items, address, shippingCost } = (await request.json()) || {};
    if (!address || !address.zip || !address.state) {
      return Response.json({ taxAmount: 0, calculationId: null });
    }

    const stripe = getStripe();
    const lineItems = (items || []).map((item) => ({
      amount: Math.round((item.price || 0) * (item.qty || 1) * 100),
      reference: item.productId || 'item',
      tax_behavior: 'exclusive',
      tax_code: item.fulfiller === 'lulu' ? 'txcd_35010000' : 'txcd_99999999',
    }));

    if (shippingCost > 0) {
      lineItems.push({
        amount: Math.round(shippingCost * 100),
        reference: 'shipping',
        tax_behavior: 'exclusive',
        tax_code: 'txcd_92010001',
      });
    }

    if (lineItems.length === 0 || lineItems.every((l) => l.amount === 0)) {
      return Response.json({ taxAmount: 0, calculationId: null });
    }

    const calculation = await stripe.tax.calculations.create({
      currency: 'usd',
      customer_details: {
        address: {
          line1: address.line1 || '',
          city: address.city || '',
          state: address.state,
          postal_code: address.zip,
          country: address.country || 'US',
        },
        address_source: 'shipping',
      },
      line_items: lineItems,
    });

    return Response.json({
      taxAmount: calculation.tax_amount_exclusive / 100,
      calculationId: calculation.id,
    });
  } catch (err) {
    console.error('Tax estimate error:', err.message);
    return Response.json({ taxAmount: 0, calculationId: null }); // degrade gracefully
  }
}
