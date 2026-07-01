import dbConnect from '@/lib/db';
import Tutor from '@/lib/models/Tutor';

export const dynamic = 'force-dynamic';

// GET /api/booking/tutors — public list of active tutors.
export async function GET() {
  try {
    await dbConnect();
    const tutors = await Tutor.find({ active: true })
      .select('name slug specialty bio')
      .sort({ sortOrder: 1, name: 1 });
    return Response.json({ tutors });
  } catch (err) {
    console.error('Tutors list error:', err);
    return Response.json({ error: 'Failed to fetch tutors.' }, { status: 500 });
  }
}
