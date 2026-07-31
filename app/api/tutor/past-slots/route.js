import { getPastSlots } from '@/lib/booking';
import { unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tutor/past-slots?days=30: occurrences of the signed-in tutor's own
// slots over the last `days` days that still have a free seat, so the tutor can
// log a student who attended without booking. Tutor-only: unlike open slots,
// past ones are not public.
export async function GET(request) {
  const { user, tutor } = await getMyTutor();
  if (!user) return unauthorized();
  if (!tutor) return notTutor();

  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days')) || 30));
    const slots = await getPastSlots({ tutorId: tutor._id, days });
    return Response.json({ slots });
  } catch (err) {
    console.error('Tutor past slots error:', err);
    return Response.json({ error: 'Failed to fetch past slots.' }, { status: 500 });
  }
}
