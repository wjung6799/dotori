import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import { expiryFor } from '@/lib/pricing';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/credits/:id  body { action: 'extend', months } | { action: 'never_expires' }
//
// The pricing FAQ tells families "packages have an expiry window, but we're
// gracious — if life gets in the way, just ask and we'll extend it once". This
// is that promise, made operable. The extension is recorded on the grant so a
// second ask is a deliberate decision rather than an invisible one.
export async function PATCH(request, { params }) {
  const admin = await getAdminUser();
  if (!admin) return forbidden();

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: 'Credit grant not found.' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  await dbConnect();
  const credit = await SessionCredit.findById(id);
  if (!credit) return Response.json({ error: 'Credit grant not found.' }, { status: 404 });

  // The FAQ promises ONE gracious extension. A second is still allowed — the
  // office knows its families — but it has to be asked for deliberately, so the
  // caller must acknowledge it rather than repeat the first click by accident.
  if (credit.extendedAt && body?.acknowledgeSecondExtension !== true) {
    return Response.json(
      {
        error: `This package was already extended on ${new Date(credit.extendedAt).toLocaleDateString('en-US')}${
          credit.extendedBy ? ` by ${credit.extendedBy}` : ''
        }. Extending again is beyond what we promise — confirm to go ahead.`,
        needsConfirmation: true,
      },
      { status: 409 },
    );
  }

  const adminName =
    [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.name || admin.email;

  if (body?.action === 'never_expires') {
    credit.expiresAt = null;
    credit.extendedAt = new Date();
    credit.extendedBy = adminName;
    await credit.save();
    return Response.json({ ok: true, expiresAt: null });
  }

  if (body?.action !== 'extend') {
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const months = Math.round(Number(body?.months));
  if (!Number.isFinite(months) || months < 1 || months > 24) {
    return Response.json({ error: 'Extend by between 1 and 24 months.' }, { status: 400 });
  }

  // Count from whichever is later: an expiry still in the future extends from
  // itself, one already past extends from today — otherwise "extend by 3 months"
  // on a grant that lapsed last year would hand back an already-dead date.
  const now = new Date();
  const base = credit.expiresAt && new Date(credit.expiresAt) > now ? new Date(credit.expiresAt) : now;

  credit.expiresAt = expiryFor(months, base);
  credit.extendedAt = now;
  credit.extendedBy = adminName;
  await credit.save();

  return Response.json({ ok: true, expiresAt: credit.expiresAt });
}
