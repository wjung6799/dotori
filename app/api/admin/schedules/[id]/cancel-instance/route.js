import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';
import { cancelOccurrence } from '@/lib/schedule-admin';

export const dynamic = 'force-dynamic';

// POST /api/admin/schedules/:id/cancel-instance — body: { dateKey, reason? }
// Cancels a single occurrence of a recurring slot (refunds bookings on it).
export async function POST(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    const { dateKey, reason } = (await request.json()) || {};
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return Response.json({ error: 'A valid dateKey is required.' }, { status: 400 });
    }
    await dbConnect();
    const schedule = await TutorSchedule.findById(id);
    if (!schedule) return Response.json({ error: 'Availability not found.' }, { status: 404 });
    const { cancelledBookings } = await cancelOccurrence({ schedule, dateKey, reason });
    return Response.json({ ok: true, cancelledBookings });
  } catch (err) {
    console.error('Cancel instance error:', err);
    return Response.json({ error: 'Failed to cancel that date.' }, { status: 500 });
  }
}
