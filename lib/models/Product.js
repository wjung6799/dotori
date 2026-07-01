import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  label:              { type: String, required: true },       // e.g. "S / Black", "Paperback"
  sku:                { type: String, default: '' },
  printfulVariantId:  { type: Number, default: null },        // Printful numeric sync_variant_id
  luluProductId:      { type: String, default: '' },          // Lulu podPackageId
  price:              { type: Number, required: true },       // in dollars
  stock:              { type: Number, default: null },        // null = unlimited (POD)
});

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, default: '' },
  imageUrl:    { type: String, default: '' },
  fulfiller:   { type: String, enum: ['printful', 'lulu', 'manual'], required: true },
  variants:    [variantSchema],
  active:      { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now },
});

export default mongoose.models.Product || mongoose.model('Product', productSchema);
