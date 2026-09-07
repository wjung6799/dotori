import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import Tutor from '@/lib/models/Tutor';
import User from '@/lib/models/User';
import { createInvoice, quarterlyDiscountLines } from '@/lib/invoicing';
import { sessionTypeLabel } from '@/lib/sessionTypes';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/admin/credits/assign
// body { userId, studentName, tutorId, sessionType, sessions, priceCents, quarter, note? }
//
// The office assigns a session pack the way it assigns a class seat: the
// family gets an invoice to settle in the portal instead of self-purchasing a
// pack at the published ladder — which is also where CUSTOM PRICING lives, as
// priceCents is whatever the office types. The credit is created pending (zero
// bookable) and activates when the invoice settles (webhook or mark-paid);
// voiding the invoice deletes it. The handbook's quarterly discounts apply
// automatically, with 1:1/semi-private assignments counting as classes.
export async function POST(request) {
  const admin = await getAdminUser();
  if (!admin) return forbidden();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const userId = body?.userId?.toString();
  const tutorId = body?.tutorId?.toString();
  const studentName = body?.studentName?.toString().trim();
  const sessionType = body?.sessionType === 'private' ? 'private' : 'semi_private';
  const sessions = Math.round(Number(body?.sessions));
  const priceCents = Math.round(Number(body?.priceCents));
  const quarter = (body?.quarter || '').toString().trim();
  const note = (body?.note || '').toString().trim().slice(0, 300);

  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(tutorId)) {
    return Response.json({ error: 'A family and an instructor are required.' }, { status: 400 });
  }
  if (!studentName) return Response.json({ error: 'A student name is required.' }, { status: 400 });
  if (!Number.isFinite(sessions) || sessions < 1 || sessions > 200) {
    return Response.json({ error: 'Sessions must be between 1 and 200.' }, { status: 400 });
  }
  if (!Number.isFinite(priceCents) || priceCents < 100) {
    return Response.json({ error: 'A price of at least $1 is required.' }, { status: 400 });
  }
  if (!quarter) return Response.json({ error: 'A quarter is required.' }, { status: 400 });

  await dbConnect();
  const [family, tutor] = await Promise.all([User.findById(userId), Tutor.findById(tutorId)]);
  if (!family || family.role !== 'family') {
    return Response.json({ error: 'Family not found.' }, { status: 404 });
  }
  if (!tutor) return Response.json({ error: 'Instructor not found.' }, { status: 404 });
  // The name keys the quarterly discounts — a typo would silently start a new
  // "student", so only names actually on the family's list are accepted.
  if (!(family.students || []).some((st) => st.name === studentName)) {
    return Response.json({ error: `${studentName} is not on this family's student list.` }, { status: 400 });
  }

  const kindLabel = sessionTypeLabel(sessionType);

  // Pending first, so the invoice can carry the link; deleted again if the
  // bill cannot be raised.
  const credit = await SessionCredit.create({
    userId: family._id,
    tutorId: tutor._id,
    sessionType,
    pending: true,
    totalSessions: sessions,
    remainingSessions: 0,
    note: note || `${sessions} ${kindLabel} session${sessions === 1 ? '' : 's'} with ${tutor.name} — assigned by the office`,
    grantedBy: admin.name || admin.email || 'admin',
    expiresAt: null,
  });

  try {
    const discounts = await quarterlyDiscountLines({
      userId: family._id,
      quarter,
      baseCents: priceCents,
    });
    const invoice = await createInvoice({
      userId: family._id,
      studentName,
      items: [
        {
          description: `${sessions} ${kindLabel} session${sessions === 1 ? '' : 's'} with ${tutor.name}`,
          detail: 'Added to your session balance as soon as this invoice is settled.',
          amountCents: priceCents,
          kind: 'credits',
        },
        ...discounts,
      ],
      quarter,
      creditId: credit._id,
      issuedBy: admin.name || admin.email || 'admin',
      notes: note,
      summary: `${sessions} ${kindLabel} sessions with ${tutor.name}`,
    });
    if (!invoice) {
      await SessionCredit.deleteOne({ _id: credit._id, pending: true });
      return Response.json({ error: 'The bill would be zero or less — check the price.' }, { status: 400 });
    }

    return Response.json({
      ok: true,
      invoice: { id: String(invoice._id), number: invoice.number, subtotalCents: invoice.subtotalCents },
      discountsApplied: discounts.map((d) => d.description),
      creditId: String(credit._id),
    });
  } catch (err) {
    // The promise must not outlive the failed bill.
    await SessionCredit.deleteOne({ _id: credit._id, pending: true }).catch(() => {});
    console.error('Session assignment error:', err);
    return Response.json({ error: 'Failed to assign the sessions.' }, { status: 500 });
  }
}
