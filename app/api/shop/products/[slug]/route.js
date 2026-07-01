import dbConnect from '@/lib/db';
import Product from '@/lib/models/Product';

export const dynamic = 'force-dynamic';

// GET /api/shop/products/:slug
export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    await dbConnect();
    const product = await Product.findOne({ slug, active: true });
    if (!product) return Response.json({ error: 'Product not found.' }, { status: 404 });
    return Response.json({ product });
  } catch (err) {
    console.error('Product fetch error:', err);
    return Response.json({ error: 'Failed to fetch product.' }, { status: 500 });
  }
}
