import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import Enrollment from '@/lib/models/Enrollment';

export const dynamic = 'force-dynamic';

// GET /api/classes/literacy-seats: PUBLIC. Live seat counts for the literacy
// weekly schedule: { seats: { [scheduleKey]: { enrolled, capacity } } }.
// Pending and paid enrollments both hold a seat; refunded ones free it.
export async function GET() {
  try {
    await dbConnect();
    const classes = await Class.find({ active: true, scheduleKey: { $nin: ['', null] } })
      .select('scheduleKey capacity manualEnrolled');
    if (classes.length === 0) return Response.json({ seats: {} });

    const counts = await Enrollment.aggregate([
      { $match: { classId: { $in: classes.map((c) => c._id) }, paymentStatus: { $in: ['pending', 'paid'] } } },
      { $group: { _id: '$classId', n: { $sum: 1 } } },
    ]);
    const byId = Object.fromEntries(counts.map((c) => [c._id.toString(), c.n]));

    const seats = {};
    for (const c of classes) {
      // An admin-entered count (manualEnrolled) overrides the automatic tally.
      const enrolled = c.manualEnrolled != null ? c.manualEnrolled : byId[c._id.toString()] || 0;
      seats[c.scheduleKey] = { enrolled, capacity: c.capacity };
    }
    return Response.json({ seats });
  } catch (err) {
    console.error('literacy-seats error:', err);
    return Response.json({ seats: {} });
  }
}
