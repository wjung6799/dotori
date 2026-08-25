import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import { defaultOnlineFeeCents } from '@/lib/pricing';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/admin/classes/:id
export async function PUT(request, { params }) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, category, quarter, schedule, description, price, capacity, active, scheduleKey } = body || {};
    const update = {};
    if (name !== undefined) update.name = name;
    if (category !== undefined) update.category = category;
    if (quarter !== undefined) update.quarter = quarter;
    if (schedule !== undefined) update.schedule = schedule;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = Number(price);
    // Blank clears the field back to null rather than storing 0, which the
    // catalog would otherwise render as a real $0 price.
    if (body?.earlyBirdPrice !== undefined) {
      update.earlyBirdPrice = body.earlyBirdPrice === '' || body.earlyBirdPrice === null
        ? null
        : Number(body.earlyBirdPrice);
    }
    if (body?.priceMax !== undefined) {
      update.priceMax = body.priceMax === '' || body.priceMax === null
        ? null
        : Number(body.priceMax);
    }
    // Blanking the fee means "go back to the automatic 3%", recomputed against
    // whatever price is being saved — not silently kept at the old figure.
    if (body?.onlineFeeCents !== undefined) {
      update.onlineFeeCents =
        body.onlineFeeCents === '' || body.onlineFeeCents === null
          ? defaultOnlineFeeCents(Math.round(Number(price ?? 0) * 100))
          : Math.max(0, Math.round(Number(body.onlineFeeCents)));
    }
    if (capacity !== undefined) update.capacity = Number(capacity);
    if (active !== undefined) update.active = active;
    if (scheduleKey !== undefined) update.scheduleKey = scheduleKey;
    if (body?.manualEnrolled !== undefined) {
      update.manualEnrolled = body.manualEnrolled === null ? null : Math.max(0, Number(body.manualEnrolled) || 0);
    }

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
