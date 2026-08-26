import dbConnect from '@/lib/db';
import Tutor from '@/lib/models/Tutor';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/admin/tutors/:id
export async function PUT(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    const body = (await request.json()) || {};
    const update = {};
    for (const k of ['name', 'specialty', 'bio', 'active', 'sortOrder']) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    // Session-credit rates for this tutor. Sanitised here because the family
    // side derives real prices from these numbers. Every field the editor can
    // set has to be carried through: a field that is read but not written back
    // is wiped the first time anyone saves the row for an unrelated reason.
    if (body.rates !== undefined) {
      update.rates = (Array.isArray(body.rates) ? body.rates : [])
        .map((r) => {
          const sessions = Math.round(Number(r?.sessions));
          const ratePerHour = Number(r?.ratePerHour);
          const months = Math.round(Number(r?.validMonths));
          // Blank means "the school's session length"; the quarter-hour floor
          // stops a typo pricing a lesson at a cent.
          const hours = Number(r?.hoursPerSession);
          return {
            // NaN rather than a coerced 1: a blank session count is a
            // half-filled row, and Math.max(1, …) would turn it into a real
            // one-session package nobody meant to sell.
            sessions,
            ratePerHour,
            hoursPerSession: Number.isFinite(hours) && hours >= 0.25 ? hours : null,
            name: (r?.name || '').toString().trim().slice(0, 60),
            tag: (r?.tag || '').toString().trim().slice(0, 40),
            // Blank means the package never lapses.
            validMonths: Number.isFinite(months) && months >= 1 ? months : null,
          };
        })
        .filter((r) => Number.isFinite(r.sessions) && r.sessions >= 1 && Number.isFinite(r.ratePerHour) && r.ratePerHour > 0);
    }
    if (body.slug !== undefined) {
      update.slug = body.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    await dbConnect();
    const tutor = await Tutor.findByIdAndUpdate(id, update, { new: true });
    if (!tutor) return Response.json({ error: 'Tutor not found.' }, { status: 404 });
    return Response.json({ ok: true, tutor });
  } catch (err) {
    console.error('Tutor update error:', err);
    return Response.json({ error: 'Failed to update tutor.' }, { status: 500 });
  }
}

// DELETE /api/admin/tutors/:id: also removes the tutor's availability slots.
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    await Tutor.findByIdAndDelete(id);
    await TutorSchedule.deleteMany({ tutorId: id });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Tutor delete error:', err);
    return Response.json({ error: 'Failed to delete tutor.' }, { status: 500 });
  }
}
