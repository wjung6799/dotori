import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName:       { type: String, required: true },   // snapshot at order time
  variantLabel:      { type: String, default: '' },
  quantity:          { type: Number, required: true, min: 1 },
  unitPrice:         { type: Number, required: true },   // dollars, snapshot
  fulfiller:         { type: String, enum: ['printful', 'lulu', 'manual'] },
  printfulVariantId: { type: Number, default: null },
  luluProductId:     { type: String, default: '' },
});

const orderSchema = new mongoose.Schema({
  // Guest info
  email:     { type: String, required: true, lowercase: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },
  phone:     { type: String, default: '' },

  // Shipping address
  address: {
    line1:   { type: String, required: true },
    line2:   { type: String, default: '' },
    city:    { type: String, required: true },
    state:   { type: String, required: true },
    zip:     { type: String, required: true },
    country: { type: String, default: 'US' },
  },

  // Cart snapshot
  items: [orderItemSchema],

  // Money (dollars)
  subtotal:     { type: Number, required: true },
  shippingCost: { type: Number, required: true },
  taxAmount:    { type: Number, default: 0 },
  total:        { type: Number, required: true },

  // Payment
  paymentStatus:          { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  stripePaymentIntentId:  { type: String, default: '' },
  stripeTaxCalculationId: { type: String, default: '' },
  paidAt:                 { type: Date },

  // Fulfillment
  fulfillmentStatus: { type: String, enum: ['unfulfilled', 'partial', 'fulfilled', 'error'], default: 'unfulfilled' },

  // Printful
  printfulOrderId: { type: Number, default: null },
  printfulStatus:  { type: String, default: '' },

  // Lulu
  luluJobId:   { type: String, default: '' },
  luluStatus:  { type: String, default: '' },

  // Shipping / tracking
  trackingNumber:    { type: String, default: '' },
  trackingUrl:       { type: String, default: '' },
  carrier:           { type: String, default: '' },
  shippedAt:         { type: Date },
  shippingEmailSent: { type: Boolean, default: false },

  // Guest order lookup token (emailed to customer)
  lookupToken: { type: String, required: true, unique: true },

  // Admin notes
  notes:     { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

orderSchema.index({ stripePaymentIntentId: 1 });
orderSchema.index({ printfulOrderId: 1 });
orderSchema.index({ luluJobId: 1 });

export default mongoose.models.Order || mongoose.model('Order', orderSchema);
