import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import Tutor from '@/lib/models/Tutor';
import { packsForTutor, findTutorPack } from '@/lib/pricing';
import { getStripe } from '@/lib/stripe';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Credits are per tutor: each one sets their own rates, and a credit bought for
// one tutor books that tutor. lib/booking.js already spends a tutor's own credit
// first and only falls back to a universal one, so nothing here has to teach the
// booking side about it.

// GET /api/family/credits: balances per tutor, the grant history, and what each
// tutor sells.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  await dbConnect();
  const [grants, tutors] = await Promise.all([
    SessionCredit.find({ userId: user._id }).populate('tutorId', 'name specialty').sort({ createdAt: -1 }).lean(),
    Tutor.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
  ]);

  // One balance per tutor, plus whatever is usable with anyone.
  const byTutor = new Map();
  let anyTutorRemaining = 0;
  for (const g of grants) {
    const remaining = g.remainingSessions || 0;
    if (remaining <= 0) continue;
    if (!g.tutorId) {
      anyTutorRemaining += remaining;
      continue;
    }
    const id = String(g.tutorId._id ?? g.tutorId);
    const row = byTutor.get(id) || { tutorId: id, tutorName: g.tutorId.name || 'Instructor', remaining: 0 };
    row.remaining += remaining;
    byTutor.set(id, row);
  }

  return Response.json({
    balances: [...byTutor.values()].sort((a, b) => a.tutorName.localeCompare(b.tutorName)),
    anyTutorRemaining,
    totalRemaining: [...byTutor.values()].reduce((s, r) => s + r.remaining, 0) + anyTutorRemaining,
    tutors: tutors.map((t) => ({
      id: String(t._id),
      name: t.name,
      specialty: t.specialty || '',
      // Falls back to the school-wide list when nobody has priced this tutor yet.
      usesDefaultRates: (t.rates || []).length === 0,
      packs: packsForTutor(t),
    })),
    grants: grants.map((g) => ({
      id: String(g._id),
      tutorName: g.tutorId?.name || null,
      totalSessions: g.totalSessions,
      remainingSessions: g.remainingSessions,
      note: g.note,
      grantedBy: g.grantedBy,
      packId: g.packId,
      amountPaidCents: g.amountPaidCents,
      onlineFeeCents: g.onlineFeeCents || 0,
      paid: Boolean(g.stripePaymentIntentId),
      createdAt: g.createdAt,
    })),
  });
}

// POST /api/family/credits  body { tutorId, packId }
// Starts a card purchase for one of that tutor's packages. The credits are
// granted by the webhook once the payment actually succeeds, so an abandoned
// checkout grants nothing.
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const tutorId = body?.tutorId?.toString();
  if (!tutorId || !mongoose.isValidObjectId(tutorId)) {
    return Response.json({ error: 'Choose an instructor first.' }, { status: 400 });
  }

  await dbConnect();
  const tutor = await Tutor.findById(tutorId);
  if (!tutor || !tutor.active) {
    return Response.json({ error: 'That instructor is not taking bookings.' }, { status: 404 });
  }

  // Resolved against THIS tutor's list. Looking the id up globally is how a
  // family ends up paying someone else's rate.
  const pack = findTutorPack(tutor, body?.packId);
  if (!pack) return Response.json({ error: 'Unknown package.' }, { status: 400 });

  const totalCents = pack.amountCents + (pack.onlineFeeCents || 0);
  if (totalCents < 50) {
    return Response.json({ error: 'That package is not purchasable right now.' }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      // Must match what PayPanel builds its Element with, or Stripe rejects the
      // confirm outright.
      payment_method_types: ['card'],
      metadata: {
        source: 'credits',
        userId: user._id.toString(),
        tutorId: String(tutor._id),
        packId: pack.id,
        sessions: String(pack.sessions),
        onlineFeeCents: String(pack.onlineFeeCents || 0),
        amountCents: String(pack.amountCents),
        packName: pack.name,
      },
      description: `Dotori School — ${pack.name} with ${tutor.name}`,
      receipt_email: user.email || undefined,
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      amountCents: totalCents,
      pack: {
        id: pack.id,
        name: pack.name,
        sessions: pack.sessions,
        priceCents: pack.amountCents,
        onlineFeeCents: pack.onlineFeeCents || 0,
      },
      tutor: { id: String(tutor._id), name: tutor.name },
    });
  } catch (err) {
    console.error('Credit purchase error:', err);
    const missingKey = /STRIPE_SECRET_KEY/.test(err?.message || '');
    return Response.json(
      {
        error: missingKey
          ? 'Card payments are not switched on yet. Please contact the school.'
          : 'Could not start the payment. Please try again.',
      },
      { status: missingKey ? 503 : 500 },
    );
  }
}
