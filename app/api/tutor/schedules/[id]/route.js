import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';
import { deleteSeries } from '@/lib/schedule-admin';
import { PRIVATE, SEMI_PRIVATE, isSessionType, sessionTypeLabel } from '@/lib/sessionTypes';

export const dynamic = 'force-dynamic';

// PATCH /api/tutor/schedules/:id  body { sessionType }
//
// Declare, or change, which kind of session one of the tutor's own slots is.
// A slot opened before slots carried a kind has none, and an undeclared slot
// takes any token (lib/booking.js) — so this is how a tutor makes an old row
// as strict as a new one. Only the kind is editable here: times, seats and
// recurrence are a delete-and-redraw on the grid, because moving a slot under
// families who already booked it is a different, riskier job.
export async function PATCH(request, { params }) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  let body;
  try {
    body = (await request.json()) || {};
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const { sessionType } = body;
  if (!isSessionType(sessionType)) {
    return Response.json(
      { error: `sessionType must be ${sessionTypeLabel(SEMI_PRIVATE)} or ${sessionTypeLabel(PRIVATE)}.` },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    await dbConnect();
    const schedule = await TutorSchedule.findById(id);
    if (!schedule || String(schedule.tutorId) !== String(tutor._id)) {
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }
    schedule.sessionType = sessionType;
    // Private means one student has the whole time, and booking fills a slot up
    // to its seat count — so a three-seat row declared private would still let
    // three families in. New private slots are opened with one seat; an old row
    // being declared private gets the same.
    if (sessionType === PRIVATE) schedule.capacity = 1;
    await schedule.save();
    return Response.json({ ok: true, schedule });
  } catch (err) {
    console.error('Tutor schedule update error:', err);
    return Response.json({ error: 'Failed to update that slot.' }, { status: 500 });
  }
}

// DELETE /api/tutor/schedules/:id: delete one of the tutor's own series.
export async function DELETE(request, { params }) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  try {
    const { id } = await params;
    await dbConnect();
    const schedule = await TutorSchedule.findById(id);
    if (!schedule || String(schedule.tutorId) !== String(tutor._id)) {
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }
    const { cancelledBookings } = await deleteSeries({ schedule });
    return Response.json({ ok: true, cancelledBookings });
  } catch (err) {
    console.error('Tutor schedule delete error:', err);
    return Response.json({ error: 'Failed to delete availability.' }, { status: 500 });
  }
}
