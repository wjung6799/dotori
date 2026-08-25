import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import { CREDIT_PACKS, findPack } from '@/lib/pricing';
import { getStripe } from '@/lib/stripe';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/family/credits: the signed-in family's credit balance + grant history
// and the packs they can buy.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  await dbConnect();
  const grants = await SessionCredit.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  const totalRemaining = grants.reduce((sum, g) => sum + (g.remainingSessions || 0), 0);

  return Response.json({
    totalRemaining,
    grants: grants.map((g) => ({
      id: String(g._id),
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
    packs: CREDIT_PACKS,
  });
}

// POST /api/family/credits: start a card purchase for one pack. Creates the
// Stripe PaymentIntent only — the credits themselves are granted by the webhook
// once the payment actually succeeds, so an abandoned checkout grants nothing.
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const pack = findPack(body?.packId);
  if (!pack) return Response.json({ error: 'Unknown package.' }, { status: 400 });
  if (!pack.amountCents || pack.amountCents < 50) {
    return Response.json({ error: 'That package is not purchasable right now.' }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    // Packs carry the same online card fee as a class seat — see CREDIT_PACKS.
    const totalCents = pack.amountCents + (pack.onlineFeeCents || 0);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      // Must match what PayPanel builds its Element with. An Element pinned to
      // card cannot be confirmed against an intent left on automatic payment
      // methods — Stripe rejects the confirm outright.
      payment_method_types: ['card'],
      // The webhook reads these back; never trust an amount sent by the client.
      metadata: {
        source: 'credits',
        userId: user._id.toString(),
        packId: pack.id,
        sessions: String(pack.sessions),
        onlineFeeCents: String(pack.onlineFeeCents || 0),
      },
      description: `Dotori School — ${pack.name} (${pack.sessions} session${pack.sessions === 1 ? '' : 's'})`,
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
    });
  } catch (err) {
    console.error('Credit purchase error:', err);
    return Response.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 });
  }
}
