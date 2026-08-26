import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/admin/classes/duplicate  body { fromQuarter, toQuarter }
// Copies a whole term's catalog into the next one. Setting up a new quarter
// otherwise means retyping a dozen classes by hand, which is where the price
// field quietly gets left at 0.
//
// Names are reused as-is, so re-running is guarded: a class whose (name,
// quarter) already exists in the target term is skipped rather than duplicated.
export async function POST(request) {
  if (!(await getAdminUser())) return forbidden();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const fromQuarter = body?.fromQuarter?.toString().trim();
  const toQuarter = body?.toQuarter?.toString().trim();
  if (!fromQuarter || !toQuarter) {
    return Response.json({ error: 'Pick both a source and a target term.' }, { status: 400 });
  }
  if (fromQuarter === toQuarter) {
    return Response.json({ error: 'Source and target term must differ.' }, { status: 400 });
  }

  try {
    await dbConnect();
    const source = await Class.find({ quarter: fromQuarter }).lean();
    if (source.length === 0) {
      return Response.json({ error: 'That term has no classes to copy.' }, { status: 404 });
    }

    const existing = new Set(
      (await Class.find({ quarter: toQuarter }).select('name').lean()).map((c) => c.name),
    );

    const toCreate = source
      .filter((c) => !existing.has(c.name))
      .map((c) => ({
        name: c.name,
        category: c.category,
        quarter: toQuarter,
        schedule: c.schedule,
        description: c.description,
        price: c.price,
        materialsFee: c.materialsFee,
        priceMax: c.priceMax,
        earlyBirdPrice: c.earlyBirdPrice,
        onlineFeeCents: c.onlineFeeCents,
        capacity: c.capacity,
        scheduleKey: c.scheduleKey,
        // Enrollment counts and manual overrides belong to the old term.
        manualEnrolled: null,
        active: c.active,
      }));

    const created = toCreate.length ? await Class.insertMany(toCreate) : [];

    return Response.json({
      ok: true,
      created: created.length,
      skipped: source.length - toCreate.length,
    });
  } catch (err) {
    console.error('Class duplicate error:', err);
    return Response.json({ error: 'Failed to copy the term.' }, { status: 500 });
  }
}
