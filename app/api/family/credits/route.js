import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import Tutor from '@/lib/models/Tutor';
import { packsForTutor, findTutorPack, sessionTypesForTutor } from '@/lib/pricing';
import { sessionTypeLabel } from '@/lib/sessionTypes';
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
  const now = new Date();
  const isSpendable = (g) =>
    (g.remainingSessions || 0) > 0 && (!g.expiresAt || new Date(g.expiresAt) >= now);

  const byTutor = new Map();
  // The credits that work with anybody are split by kind for the same reason the
  // per-tutor rows are: a semi-private credit cannot book a private slot, so one
  // combined "usable with anybody" figure promises sessions booking will refuse.
  // A null kind is its own row and stays spelled out as "any session type".
  const byAnyTutor = new Map();
  let anyTutorRemaining = 0;
  let expiredSessions = 0;
  for (const g of grants) {
    const remaining = g.remainingSessions || 0;
    if (remaining <= 0) continue;
    // Lapsed sessions are surfaced as their own number, never folded into a
    // balance the booking route would then refuse.
    if (!isSpendable(g)) {
      expiredSessions += remaining;
      continue;
    }
    if (!g.tutorId) {
      anyTutorRemaining += remaining;
      const anyKey = g.sessionType || 'any';
      const anyRow = byAnyTutor.get(anyKey) || {
        sessionType: g.sessionType || null,
        sessionTypeLabel: g.sessionType ? sessionTypeLabel(g.sessionType) : 'Any session type',
        remaining: 0,
      };
      anyRow.remaining += remaining;
      byAnyTutor.set(anyKey, anyRow);
      continue;
    }
    const id = String(g.tutorId._id ?? g.tutorId);
    // Keyed by kind as well, because a private credit cannot book a
    // semi-private slot and a combined figure would promise sessions the family
    // cannot actually use.
    const type = g.sessionType || 'any';
    const key = id + '|' + type;
    const row = byTutor.get(key) || {
      tutorId: id,
      tutorName: g.tutorId.name || 'Instructor',
      sessionType: g.sessionType || null,
      sessionTypeLabel: g.sessionType ? sessionTypeLabel(g.sessionType) : 'Any session type',
      remaining: 0,
    };
    row.remaining += remaining;
    byTutor.set(key, row);
  }

  return Response.json({
    balances: [...byTutor.values()].sort((a, b) => a.tutorName.localeCompare(b.tutorName)),
    anyTutorRemaining,
    // Untyped first: those are the ones that book anything.
    anyTutorBalances: [...byAnyTutor.values()].sort((a, b) =>
      a.sessionType === b.sessionType ? 0 : a.sessionType ? 1 : -1,
    ),
    totalRemaining: [...byTutor.values()].reduce((s, r) => s + r.remaining, 0) + anyTutorRemaining,
    expiredSessions,
    tutors: tutors.map((t) => ({
      id: String(t._id),
      name: t.name,
      specialty: t.specialty || '',
      // Falls back to the school-wide list when nobody has priced this tutor yet.
      usesDefaultRates: (t.rates || []).length === 0,
      // Only the kinds this tutor has actually priced. Offering "Private" from
      // someone who has not set a private rate would quote the group price.
      sessionTypes: sessionTypesForTutor(t).map((type) => ({
        type,
        label: sessionTypeLabel(type),
        packs: packsForTutor(t, type),
      })),
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
      sessionType: g.sessionType || null,
      sessionTypeLabel: g.sessionType ? sessionTypeLabel(g.sessionType) : 'Any session type',
      expiresAt: g.expiresAt,
      extendedAt: g.extendedAt,
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
        // Stamped on the grant by the webhook: this is what the credit may book.
        sessionType: pack.sessionType || 'semi_private',
        // The window is fixed at purchase. Repricing the package later must not
        // move the expiry on sessions a family already owns.
        validMonths: String(pack.validMonths ?? ''),
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
        validMonths: pack.validMonths ?? null,
        sessionType: pack.sessionType || 'semi_private',
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
