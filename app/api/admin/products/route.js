import dbConnect from '@/lib/db';
import Product from '@/lib/models/Product';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/products — all products (active + inactive)
export async function GET() {
  if (!(await getAdminUser())) return forbidden();
  try {
    await dbConnect();
    const products = await Product.find().sort({ createdAt: -1 });
    return Response.json({ products });
  } catch (err) {
    console.error('Admin products fetch error:', err);
    return Response.json({ error: 'Failed to fetch products.' }, { status: 500 });
  }
}

// POST /api/admin/products
export async function POST(request) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const body = (await request.json()) || {};
    const { name, slug, description, imageUrl, fulfiller, variants, active } = body;
    if (!name || !fulfiller) {
      return Response.json({ error: 'Name and fulfiller are required.' }, { status: 400 });
    }
    const autoSlug = (slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    await dbConnect();
    const product = await Product.create({
      name,
      slug: autoSlug,
      description,
      imageUrl,
      fulfiller,
      variants: variants || [],
      active: active !== false,
    });
    return Response.json({ ok: true, product });
  } catch (err) {
    if (err.code === 11000) {
      return Response.json({ error: 'A product with that slug already exists.' }, { status: 400 });
    }
    console.error('Product create error:', err);
    return Response.json({ error: 'Failed to create product.' }, { status: 500 });
  }
}
