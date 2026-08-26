import dbConnect from '@/lib/db';
import Tutor from '@/lib/models/Tutor';
import SessionCredit from '@/lib/models/SessionCredit';
import { packsForTutor, CREDIT_PACKS, HOURS_PER_SESSION } from '@/lib/pricing';
import { getTutorOrAdmin, unauthorized } from '@/lib/auth-helpers';
import { getMyTutor, notTutor } from '@/lib/tutor-helpers';

export const dynamic = 'force-dynamic';

// A tutor sets their own session-credit prices. Scoped to their own profile —
// getMyTutor resolves the Tutor linked to the signed-in account, so there is no
// id in the request that could be pointed at someone else.

// GET /api/tutor/rates
export async function GET() {
  if (!(await getTutorOrAdmin())) return unauthorized();
  const { tutor } = await getMyTutor();
  if (!tutor) return notTutor();

  await dbConnect();
  // Credits already sold at the current prices. Changing a rate never re-prices
  // what a family already bought, and saying so stops that being a worry.
  //
  // SUM the remaining sessions, never count the grant documents: one 40-session
  // purchase is a single SessionCredit row, so counting rows would report "1
  // session already paid for" against forty that still have to be taught. Every
  // other credit total in the app (the family dashboard, /api/booking/me) is
  // this same sum, and both screens reading this field label it "sessions".
  const [creditAgg] = await SessionCredit.aggregate([
    {
      $match: {
        tutorId: tutor._id,
        remainingSessions: { $gt: 0 },
        // Lapsed sessions are not an obligation any more.
        $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }],
      },
    },
    { $group: { _id: null, sessions: { $sum: '$remainingSessions' } } },
  ]);
  const soldCredits = creditAgg?.sessions || 0;

  return Response.json({
    tutor: { id: String(tutor._id), name: tutor.name, specialty: tutor.specialty || '' },
    rates: (tutor.rates || []).map((r) => ({
      sessions: r.sessions,
      ratePerHour: r.ratePerHour,
      tag: r.tag || '',
      // null = this package never lapses. Send it through as null rather than
      // omitting the field: the editor treats a missing value as "no expiry"
      // too, but then saves that blank back over a window someone did set.
      validMonths: r.validMonths ?? null,
    })),
    usesDefaultRates: (tutor.rates || []).length === 0,
    // What a family is quoted right now, whether that comes from these rates or
    // the school-wide fallback.
    packs: packsForTutor(tutor),
    defaults: CREDIT_PACKS.map((p) => ({
      name: p.name,
      sessions: p.sessions,
      amountCents: p.amountCents,
      ratePerHour: p.ratePerHour,
    })),
    hoursPerSession: HOURS_PER_SESSION,
    outstandingCredits: soldCredits,
  });
}

// PUT /api/tutor/rates  body { rates: [{ sessions, ratePerHour, tag, validMonths }] }
// An empty list hands this tutor back to the school-wide defaults.
export async function PUT(request) {
  if (!(await getTutorOrAdmin())) return unauthorized();
  const { tutor } = await getMyTutor();
  if (!tutor) return notTutor();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const incoming = Array.isArray(body?.rates) ? body.rates : [];
  const cleaned = [];
  const seen = new Set();
  for (const r of incoming) {
    const sessions = Math.round(Number(r?.sessions));
    const ratePerHour = Number(r?.ratePerHour);
    // A row missing either number is a half-filled form, not a package. Dropping
    // it silently would let a blank session count become a live 1-session pack.
    if (!Number.isFinite(sessions) || sessions < 1) continue;
    if (!Number.isFinite(ratePerHour) || ratePerHour <= 0) continue;
    // Two packages with the same session count would be indistinguishable to a
    // family, and their generated ids would collide.
    if (seen.has(sessions)) {
      return Response.json(
        { error: `You have two packages of ${sessions} session${sessions === 1 ? '' : 's'}. Give each a different size.` },
        { status: 400 },
      );
    }
    seen.add(sessions);
    // Blank / absent means the package never lapses, so it stores as null — a 0
    // would read as a package that expired the moment it was paid for. Carried
    // through here because the editor sends it: dropping it would silently wipe
    // the window an admin set on this tutor the next time they save a rate.
    const months = Math.round(Number(r?.validMonths));
    cleaned.push({
      sessions,
      ratePerHour,
      tag: (r?.tag || '').toString().trim().slice(0, 40),
      validMonths: Number.isFinite(months) && months >= 1 ? months : null,
    });
  }

  cleaned.sort((a, b) => a.sessions - b.sessions);

  await dbConnect();
  tutor.rates = cleaned;
  await tutor.save();

  return Response.json({
    ok: true,
    rates: cleaned,
    dropped: incoming.length - cleaned.length,
    usesDefaultRates: cleaned.length === 0,
    packs: packsForTutor(tutor),
  });
}
