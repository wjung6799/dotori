import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';
import { deleteSeries } from '@/lib/schedule-admin';

export const dynamic = 'force-dynamic';

// PUT /api/admin/schedules/:id
export async function PUT(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    const body = (await request.json()) || {};
    const update = {};
    for (const k of ['subject', 'specificDate', 'notes', 'active']) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    for (const k of ['dayOfWeek', 'startMinute', 'durationMinutes', 'capacity']) {
      if (body[k] !== undefined) update[k] = Number(body[k]);
    }
    await dbConnect();
    const schedule = await TutorSchedule.findByIdAndUpdate(id, update, { new: true });
    if (!schedule) return Response.json({ error: 'Availability not found.' }, { status: 404 });
    return Response.json({ ok: true, schedule });
  } catch (err) {
    console.error('Schedule update error:', err);
    return Response.json({ error: 'Failed to update availability.' }, { status: 500 });
  }
}

// DELETE /api/admin/schedules/:id: delete the whole series (refunds future bookings)
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    const schedule = await TutorSchedule.findById(id);
    if (!schedule) return Response.json({ error: 'Availability not found.' }, { status: 404 });
    const { cancelledBookings } = await deleteSeries({ schedule });
    return Response.json({ ok: true, cancelledBookings });
  } catch (err) {
    console.error('Schedule delete error:', err);
    return Response.json({ error: 'Failed to delete availability.' }, { status: 500 });
  }
}
