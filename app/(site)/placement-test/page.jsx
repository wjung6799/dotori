import dbConnect from '@/lib/db';
import Tutor from '@/lib/models/Tutor';
import PlacementBooking from './PlacementBooking';

export const metadata = {
  title: 'Book a Placement Test | Dotori School',
  description:
    'Book a placement test at Dotori School in Bellevue: a 30-minute assessment with Mrs. Jung followed by a 15-minute parent consultation. No account needed.',
};

export const dynamic = 'force-dynamic';

// Public placement-test booking. Open times come from Mrs. Jung's
// diagnostic-kind availability (set in Admin → Booking → Availability).
export default async function PlacementTestPage() {
  let tutorId = null;
  try {
    await dbConnect();
    const tutor = await Tutor.findOne({ name: /yesol/i, active: true }).select('_id');
    tutorId = tutor ? tutor._id.toString() : null;
  } catch (err) {
    console.error('Placement test tutor lookup failed:', err);
  }
  return <PlacementBooking tutorId={tutorId} />;
}
