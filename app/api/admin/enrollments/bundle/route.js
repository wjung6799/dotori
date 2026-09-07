import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import Class from '@/lib/models/Class';
import User from '@/lib/models/User';
import { createInvoice, bundleDiscountLines } from '@/lib/invoicing';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/admin/enrollments/bundle
// body { userId, items: [{ classId, studentName, priceOption? }], notes? }
//
// One family, several seats, ONE invoice. Each item becomes its own enrollment
// (so seat counts, drops and reports stay per-student), but they are billed on
// a single invoice with a tuition line each and the quarterly discounts —
// sibling / multi-class — applied ONCE across the whole bundle. Settling that
// invoice settles every enrollment on it. For a single seat, use the plain
// POST /api/admin/enrollments; this route is the sibling case.
export async function POST(request) {
  if (!(await getAdminUser())) return forbidden();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const userId = body?.userId?.toString();
  const notes = (body?.notes || '').toString().trim().slice(0, 500);
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return Response.json({ error: 'A family is required.' }, { status: 400 });
  }
  if (rawItems.length < 1) {
    return Response.json({ error: 'Add at least one student and class.' }, { status: 400 });
  }
  if (rawItems.length > 20) {
    return Response.json({ error: 'Too many seats in one bundle.' }, { status: 400 });
  }

  await dbConnect();
  const family = await User.findById(userId);
  if (!family || family.role !== 'family') {
    return Response.json({ error: 'Family not found.' }, { status: 404 });
  }

  // Resolve and validate every item first: nothing is created until the whole
  // bundle is known-good, so a bad row cannot leave half a bundle behind.
  const resolved = [];
  const quarters = new Set();
  // Seats claimed per class WITHIN this bundle, so two siblings into the same
  // class are both checked against capacity.
  const claimHere = new Map();
  for (const raw of rawItems) {
    const classId = raw?.classId?.toString();
    const studentName = raw?.studentName?.toString().trim();
    const optLabel = raw?.priceOption?.toString().trim() || null;
    if (!classId || !mongoose.isValidObjectId(classId) || !studentName) {
      return Response.json({ error: 'Each row needs a student and a class.' }, { status: 400 });
    }
    if (!(family.students || []).some((st) => st.name === studentName)) {
      return Response.json({ error: `${studentName} is not on this family's student list.` }, { status: 400 });
    }
    const cls = await Class.findById(classId);
    if (!cls) return Response.json({ error: 'A class was not found.' }, { status: 404 });

    const priceOption = optLabel
      ? (cls.priceOptions || []).find((o) => o.label === optLabel) || null
      : null;
    if (optLabel && !priceOption) {
      return Response.json({ error: `That pricing option is not on ${cls.name}.` }, { status: 400 });
    }

    const already = await Enrollment.findOne({ userId, classId, studentName, paymentStatus: { $ne: 'refunded' } });
    if (already) {
      return Response.json({ error: `${studentName} is already enrolled in ${cls.name}.` }, { status: 409 });
    }

    const seatedNow = await Enrollment.countDocuments({ classId, paymentStatus: { $in: ['pending', 'paid'] } });
    const claimed = (claimHere.get(classId) || 0) + 1;
    claimHere.set(classId, claimed);
    if (seatedNow + claimed > (cls.capacity ?? 0)) {
      return Response.json({ error: `${cls.name} is full (${seatedNow}/${cls.capacity}).` }, { status: 409 });
    }

    const tuitionCents = Math.round(Number(priceOption?.price ?? cls.price ?? 0) * 100);
    if (tuitionCents <= 0) {
      return Response.json({ error: `${cls.name} has no price set.` }, { status: 400 });
    }
    quarters.add(cls.quarter || '');
    resolved.push({ cls, studentName, priceOption, tuitionCents });
  }

  // Discounts are a per-family-per-quarter thing, so a bundle spanning two
  // quarters cannot carry one clean discount decision.
  if (quarters.size > 1) {
    return Response.json({ error: 'Bundle everything in one quarter at a time.' }, { status: 400 });
  }
  const quarter = [...quarters][0] || '';

  // Discounts decided across the whole bundle BEFORE the enrollments exist, so
  // the bundle's own students are not counted against themselves.
  const baseCents = resolved.reduce((sum, r) => sum + r.tuitionCents, 0);
  const discounts = await bundleDiscountLines({
    userId: family._id,
    quarter,
    items: resolved.map((r) => ({ studentName: r.studentName })),
    baseCents,
  });

  const created = [];
  try {
    for (const r of resolved) {
      const enr = await Enrollment.create({
        userId: family._id,
        classId: r.cls._id,
        studentName: r.studentName,
        quarter: r.cls.quarter,
        paymentStatus: 'pending',
        amountPaid: r.tuitionCents / 100,
        notes: notes || 'Added by admin (bundle)',
      });
      created.push({ enr, r });
    }

    const invoice = await createInvoice({
      userId: family._id,
      studentName: resolved.map((r) => r.studentName).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      items: [
        ...created.map(({ r }) => ({
          description: `${r.cls.name} — tuition · ${r.studentName}`,
          detail: [r.cls.schedule, r.priceOption ? r.priceOption.label : ''].filter(Boolean).join(' · '),
          amountCents: r.tuitionCents,
          kind: 'tuition',
        })),
        ...discounts,
      ],
      quarter,
      enrollmentId: created[0].enr._id,
      enrollmentIds: created.map(({ enr }) => enr._id),
      issuedBy: 'admin',
      notes,
      summary: `${created.length} seats for the family`,
    });
    if (!invoice) {
      await Enrollment.deleteMany({ _id: { $in: created.map((c) => c.enr._id) } });
      return Response.json({ error: 'The bundle total came out at zero — check the prices.' }, { status: 400 });
    }

    return Response.json(
      {
        ok: true,
        invoice: { id: String(invoice._id), number: invoice.number, subtotalCents: invoice.subtotalCents },
        seats: created.length,
        discountsApplied: discounts.map((d) => d.description),
      },
      { status: 201 },
    );
  } catch (err) {
    // A failure after some enrollments exist must not leave a partial bundle.
    if (created.length) {
      await Enrollment.deleteMany({ _id: { $in: created.map((c) => c.enr._id) } }).catch(() => {});
    }
    console.error('Bundle enrollment error:', err);
    return Response.json({ error: 'Failed to create the bundle.' }, { status: 500 });
  }
}
