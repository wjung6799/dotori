import dbConnect from '@/lib/db';
import Product from '@/lib/models/Product';

export const dynamic = 'force-dynamic';

// GET /api/shop/products
export async function GET() {
  try {
    await dbConnect();
    const products = await Product.find({ active: true }).sort({ createdAt: 1 });
    return Response.json({ products });
  } catch (err) {
    console.error('Products fetch error:', err);
    return Response.json({ error: 'Failed to fetch products.' }, { status: 500 });
  }
}
