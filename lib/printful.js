import Order from '@/lib/models/Order';

// Create a Printful order for the printful-fulfilled items in an order.
export async function createPrintfulOrder(order) {
  const printfulItems = order.items
    .filter((i) => i.fulfiller === 'printful' && i.printfulVariantId)
    .map((i) => ({ sync_variant_id: i.printfulVariantId, quantity: i.quantity }));

  if (printfulItems.length === 0) return;

  const body = {
    recipient: {
      name: `${order.firstName} ${order.lastName}`,
      address1: order.address.line1,
      address2: order.address.line2 || '',
      city: order.address.city,
      state_code: order.address.state,
      zip: order.address.zip,
      country_code: order.address.country || 'US',
      email: order.email,
      phone: order.phone || '',
    },
    items: printfulItems,
    retail_costs: { shipping: order.shippingCost.toFixed(2) },
  };

  try {
    const res = await fetch('https://api.printful.com/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.code === 200) {
      await Order.findByIdAndUpdate(order._id, {
        printfulOrderId: data.result.id,
        printfulStatus: data.result.status,
      });
      console.log(`Printful order created for order ${order._id}: ${data.result.id}`);
    } else {
      console.error('Printful order creation failed:', JSON.stringify(data));
      await Order.findByIdAndUpdate(order._id, { fulfillmentStatus: 'error' });
    }
  } catch (err) {
    console.error('Printful API error:', err.message);
    await Order.findByIdAndUpdate(order._id, { fulfillmentStatus: 'error' });
  }
}
