import dbConnect from '@/lib/db';
import Tutor from '@/lib/models/Tutor';
import SessionCredit from '@/lib/models/SessionCredit';
import { packsForTutor, tutorPackId, CREDIT_PACKS, HOURS_PER_SESSION, hoursForRate } from '@/lib/pricing';
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
      // null = this package uses the school-wide session length. Same reasoning
      // as validMonths below: send the null so the editor round-trips it instead
      // of writing a length nobody chose.
      hoursPerSession: r.hoursPerSession ?? null,
      name: r.name || '',
      tag: r.tag || '',
      // null = this package never lapses. Send it through as null rather than
      // omitting the field: the editor treats a missing value as "no expiry"
      // too, but then saves that blank back over a window someone did set.
      validMonths: r.validMonths ?? null,
      sessionType: r.sessionType || 'semi_private',
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

// PUT /api/tutor/rates  body { rates: [{ sessions, ratePerHour, hoursPerSession, name, tag, validMonths }] }
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
    // Blank / absent means "the school's session length", so it stores as null.
    // A quarter-hour floor keeps a typo like 0.01 from pricing a lesson at a
    // cent while still allowing a 30-minute package.
    const rawHours = Number(r?.hoursPerSession);
    const hoursPerSession = Number.isFinite(rawHours) && rawHours >= 0.25 ? rawHours : null;
    const hours = hoursForRate({ hoursPerSession });
    // Which product this package sells: semi-private unless it explicitly says
    // private. Resolved here, before the duplicate check, because the kind is
    // part of a pack's identity.
    const sessionType = r?.sessionType === 'private' ? 'private' : 'semi_private';

    // Two packages a family could not tell apart, and whose generated ids would
    // collide, so one would redeem against the other's price. Size alone is not
    // the test any more: twelve 60-minute 1:1 lessons and twelve 90-minute
    // semi-private ones are both "12 sessions" and are two different products.
    // The kind counts too: twelve private lessons and twelve semi-private ones
    // at the same rate are two products with two ids, and rejecting the pair as
    // identical would stop a tutor pricing both ladders at once.
    const id = tutorPackId(sessions, ratePerHour, hours, sessionType);
    if (seen.has(id)) {
      return Response.json(
        {
          error: `You have two identical packages of ${sessions} session${sessions === 1 ? '' : 's'} at $${ratePerHour}/hour. Change the size, the rate or the session length on one of them.`,
        },
        { status: 400 },
      );
    }
    seen.add(id);
    // Blank / absent means the package never lapses, so it stores as null — a 0
    // would read as a package that expired the moment it was paid for. Carried
    // through here because the editor sends it: dropping it would silently wipe
    // the window an admin set on this tutor the next time they save a rate.
    const months = Math.round(Number(r?.validMonths));
    cleaned.push({
      sessions,
      ratePerHour,
      hoursPerSession,
      name: (r?.name || '').toString().trim().slice(0, 60),
      tag: (r?.tag || '').toString().trim().slice(0, 40),
      validMonths: Number.isFinite(months) && months >= 1 ? months : null,
      sessionType,
    });
  }

  // Same order the family is quoted in: each lesson length's ladder read top to
  // bottom, rather than two formats interleaved by session count.
  cleaned.sort((a, b) => hoursForRate(a) - hoursForRate(b) || a.sessions - b.sessions);

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
