import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/admin/classes/:id
export async function PUT(request, { params }) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, category, quarter, schedule, description, price, capacity, active } = body || {};
    const update = {};
    if (name !== undefined) update.name = name;
    if (category !== undefined) update.category = category;
    if (quarter !== undefined) update.quarter = quarter;
    if (schedule !== undefined) update.schedule = schedule;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = Number(price);
    if (capacity !== undefined) update.capacity = Number(capacity);
    if (active !== undefined) update.active = active;

    await dbConnect();
    const cls = await Class.findByIdAndUpdate(id, update, { new: true });
    return Response.json({ ok: true, class: cls });
  } catch (err) {
    console.error('Class update error:', err);
    return Response.json({ error: 'Failed to update class.' }, { status: 500 });
  }
}

// DELETE /api/admin/classes/:id
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const { id } = await params;
    await dbConnect();
    await Class.findByIdAndDelete(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Class delete error:', err);
    return Response.json({ error: 'Failed to delete class.' }, { status: 500 });
  }
}
