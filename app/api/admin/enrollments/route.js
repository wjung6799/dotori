import dbConnect from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import Invoice from '@/lib/models/Invoice';
import { createClassInvoice } from '@/lib/invoicing';
import User from '@/lib/models/User';   // registers model for populate()
import Class from '@/lib/models/Class'; // registers model for populate()
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/enrollments
export async function GET(request) {
  if (!(await getAdminUser())) return forbidden();

  try {
    await dbConnect();
    void User;
    void Class;
    const { searchParams } = new URL(request.url);
    const filter = {};
    if (searchParams.get('quarter')) filter.quarter = searchParams.get('quarter');
    if (searchParams.get('status')) filter.paymentStatus = searchParams.get('status');
    // Lets the class catalog show one class's roster without pulling every
    // enrollment the school has ever recorded.
    if (searchParams.get('classId')) filter.classId = searchParams.get('classId');

    const enrollments = await Enrollment.find(filter)
      .populate('userId', 'firstName lastName email phone name students')
      .populate('classId', 'name schedule price')
      .sort({ enrolledAt: -1 });
    return Response.json({ enrollments });
  } catch (err) {
    console.error('Admin enrollments fetch error:', err);
    return Response.json({ error: 'Failed to fetch enrollments.' }, { status: 500 });
  }
}

// POST /api/admin/enrollments: place a student in a class. The office assigns
// seats — families do not sign themselves up — so this is where a bill starts.
// When the seat is not already settled, an Invoice is raised for the class price
// and the family pays it themselves in the portal. Also feeds the live seat
// counts on the public literacy schedule.
export async function POST(request) {
  if (!(await getAdminUser())) return forbidden();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const userId = body?.userId?.toString();
  const classId = body?.classId?.toString();
  const studentName = body?.studentName?.toString().trim();
  const paymentStatus = ['pending', 'paid'].includes(body?.paymentStatus) ? body.paymentStatus : 'paid';
  const notes = (body?.notes || '').toString().trim().slice(0, 500);
  if (!userId || !classId || !studentName) {
    return Response.json({ error: 'Family, student, and class are required.' }, { status: 400 });
  }

  try {
    await dbConnect();
    const cls = await Class.findById(classId);
    if (!cls) return Response.json({ error: 'Class not found.' }, { status: 404 });

    const existing = await Enrollment.findOne({
      userId, classId, studentName, paymentStatus: { $ne: 'refunded' },
    });
    if (existing) {
      return Response.json({ error: 'That student is already enrolled in this class.' }, { status: 409 });
    }

    const seated = await Enrollment.countDocuments({
      classId, paymentStatus: { $in: ['pending', 'paid'] },
    });
    if (seated >= (cls.capacity ?? 0)) {
      return Response.json({ error: `Class is full (${seated}/${cls.capacity}).` }, { status: 409 });
    }

    const enrollment = await Enrollment.create({
      userId,
      classId,
      studentName,
      quarter: cls.quarter,
      paymentStatus,
      // Record what the seat costs. This used to be left at 0 regardless of the
      // class price, which made every admin-created enrollment look free.
      amountPaid: Number(cls.price) || 0,
      notes: notes || 'Added by admin',
      ...(paymentStatus === 'paid' ? { paidAt: new Date() } : {}),
    });

    // Only an unsettled seat gets a bill. Marking it paid means the money
    // already arrived (Zelle, cash, a previous term's credit).
    let invoice = null;
    if (paymentStatus !== 'paid') {
      try {
        invoice = await createClassInvoice({
          user: { _id: userId },
          enrollment,
          cls,
          issuedBy: 'admin',
        });
      } catch (invErr) {
        // The seat is real even if the paperwork failed; surface it rather than
        // rolling back a placement the office just made.
        console.error('Invoice creation failed for enrollment', String(enrollment._id), invErr);
      }
    }

    return Response.json(
      {
        ok: true,
        enrollment,
        invoice: invoice ? { id: String(invoice._id), number: invoice.number, subtotalCents: invoice.subtotalCents } : null,
        // Tell the admin why no bill appeared, instead of leaving them guessing.
        invoiceNote:
          paymentStatus === 'paid'
            ? 'Marked paid — no invoice raised.'
            : invoice
              ? null
              : 'No invoice: this class has no price set.',
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Admin enrollment create error:', err);
    return Response.json({ error: 'Failed to create enrollment.' }, { status: 500 });
  }
}
