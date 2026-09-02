import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';
import { stopSeries } from '@/lib/schedule-admin';

export const dynamic = 'force-dynamic';

// POST /api/admin/schedules/:id/stop: stop offering this series from now on,
// keeping every session already booked on it (nothing cancelled or refunded).
export async function POST(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    const schedule = await TutorSchedule.findById(id);
    if (!schedule) return Response.json({ error: 'Availability not found.' }, { status: 404 });
    const { keptBookings, pausedSeries } = await stopSeries({ schedule });
    return Response.json({ ok: true, keptBookings, pausedSeries });
  } catch (err) {
    console.error('Schedule stop error:', err);
    return Response.json({ error: 'Failed to stop availability.' }, { status: 500 });
  }
}
