import dbConnect from '@/lib/db';
import Product from '@/lib/models/Product';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/admin/products/:id
export async function PUT(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    const body = (await request.json()) || {};
    const { name, slug, description, imageUrl, fulfiller, variants, active } = body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (slug !== undefined)
      update.slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (description !== undefined) update.description = description;
    if (imageUrl !== undefined) update.imageUrl = imageUrl;
    if (fulfiller !== undefined) update.fulfiller = fulfiller;
    if (variants !== undefined) update.variants = variants;
    if (active !== undefined) update.active = active;

    await dbConnect();
    const product = await Product.findByIdAndUpdate(id, update, { new: true });
    if (!product) return Response.json({ error: 'Product not found.' }, { status: 404 });
    return Response.json({ ok: true, product });
  } catch (err) {
    console.error('Product update error:', err);
    return Response.json({ error: 'Failed to update product.' }, { status: 500 });
  }
}

// DELETE /api/admin/products/:id
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    await Product.findByIdAndDelete(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Product delete error:', err);
    return Response.json({ error: 'Failed to delete product.' }, { status: 500 });
  }
}
