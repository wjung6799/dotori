import { getAvailableSlots } from '@/lib/booking';

export const dynamic = 'force-dynamic';

// GET /api/booking/slots?tutorId=...&days=28 — public available slots.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tutorId = searchParams.get('tutorId') || undefined;
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days')) || 28));
    // Defaults to paid slots; the diagnostic page passes ?kind=diagnostic.
    const kind = searchParams.get('kind') === 'diagnostic' ? 'diagnostic' : 'session';
    const slots = await getAvailableSlots({ tutorId, days, kind });
    return Response.json({ slots });
  } catch (err) {
    console.error('Slots error:', err);
    return Response.json({ error: 'Failed to fetch slots.' }, { status: 500 });
  }
}
