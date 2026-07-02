import dbConnect from '@/lib/db';
import Class from '@/lib/models/Class';
import Enrollment from '@/lib/models/Enrollment';
import { getStripe } from '@/lib/stripe';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/classes/:id/enroll — create pending enrollment + Stripe PaymentIntent.
export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;
    const { studentName, dayChoice } = (await request.json()) || {};
    if (!studentName || !studentName.trim()) {
      return Response.json({ error: 'Student name is required.' }, { status: 400 });
    }

    await dbConnect();
    const cls = await Class.findById(id);
    if (!cls || !cls.active) return Response.json({ error: 'Class not found.' }, { status: 404 });

    // Require dayChoice for multi-day classes
    const isMultiDay = cls.schedule && cls.schedule.includes(' or ');
    if (isMultiDay && !dayChoice) {
      return Response.json({ error: 'Please select a day for this class.' }, { status: 400 });
    }

    // Capacity check
    const enrolledCount = await Enrollment.countDocuments({
      classId: cls._id,
      paymentStatus: { $ne: 'refunded' },
    });
    if (enrolledCount >= cls.capacity) {
      return Response.json({ error: 'This class is full.' }, { status: 400 });
    }

    // Already-enrolled check
    const existing = await Enrollment.findOne({
      userId: user._id,
      classId: cls._id,
      studentName: studentName.trim(),
      paymentStatus: { $ne: 'refunded' },
    });
    if (existing) {
      return Response.json(
        { error: 'This student is already enrolled in this class.' },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(cls.price * 100),
      currency: 'usd',
      metadata: {
        userId: user._id.toString(),
        classId: cls._id.toString(),
        studentName: studentName.trim(),
        quarter: cls.quarter,
      },
    });

    const enrollment = await Enrollment.create({
      userId: user._id,
      studentName: studentName.trim(),
      classId: cls._id,
      quarter: cls.quarter,
      paymentStatus: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      amountPaid: cls.price,
      dayChoice: dayChoice ? dayChoice.trim() : '',
    });

    return Response.json({ clientSecret: paymentIntent.client_secret, enrollmentId: enrollment._id });
  } catch (err) {
    console.error('Enroll error:', err);
    return Response.json({ error: 'Failed to initiate enrollment.' }, { status: 500 });
  }
}
