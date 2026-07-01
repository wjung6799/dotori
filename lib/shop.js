// Shared shop pricing config (mirrors the Express shop router).
const FLAT_SHIPPING = parseFloat(process.env.SHOP_FLAT_SHIPPING || '5.99');
const FREE_THRESHOLD = parseFloat(process.env.SHOP_FREE_SHIPPING_THRESHOLD || '50');

export function calcShipping(subtotal) {
  return subtotal >= FREE_THRESHOLD ? 0 : FLAT_SHIPPING;
}

// Whitelisted public view of an order (no internal Stripe/fulfiller ids).
export function publicOrderView(order) {
  return {
    lookupToken: order.lookupToken,
    email: order.email,
    firstName: order.firstName,
    lastName: order.lastName,
    address: order.address,
    items: order.items,
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    taxAmount: order.taxAmount,
    total: order.total,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    carrier: order.carrier,
    shippedAt: order.shippedAt,
    createdAt: order.createdAt,
  };
}
