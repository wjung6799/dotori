import { put } from '@vercel/blob';
import dbConnect from '@/lib/db';
import Report from '@/lib/models/Report';
import User from '@/lib/models/User';
import { sendReportNotification } from '@/lib/mailer';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/reports/upload — multipart form with a `pdf` file + fields.
// Stores the PDF in Vercel Blob (was multer/disk under Express).
export async function POST(request) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const form = await request.formData();
    const file = form.get('pdf');
    if (!file || typeof file === 'string') {
      return Response.json({ error: 'PDF file is required.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return Response.json({ error: 'Only PDF files are allowed.' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'PDF must be 10 MB or smaller.' }, { status: 400 });
    }

    const userId = form.get('userId');
    const studentName = form.get('studentName');
    const classId = form.get('classId');
    const quarter = form.get('quarter');
    const title = form.get('title');
    if (!userId || !studentName || !quarter || !title) {
      return Response.json(
        { error: 'userId, studentName, quarter, and title are required.' },
        { status: 400 },
      );
    }

    const safeName = String(file.name || 'report.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const blob = await put(`reports/${Date.now()}-${safeName}`, file, {
      access: 'public',
      contentType: 'application/pdf',
    });

    await dbConnect();
    const report = await Report.create({
      userId,
      studentName,
      classId: classId || undefined,
      quarter,
      title,
      pdfPath: blob.url,
    });

    // Notify the parent (non-fatal)
    try {
      const parent = await User.findById(userId).select('email firstName name');
      if (parent && parent.email) {
        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        await sendReportNotification({
          to: parent.email,
          parentName: parent.firstName || parent.name || 'there',
          studentName,
          title,
          quarter,
          siteUrl,
        });
      }
    } catch (mailErr) {
      console.error('Report email notification failed:', mailErr.message);
    }

    return Response.json({ ok: true, report });
  } catch (err) {
    console.error('Report upload error:', err);
    return Response.json({ error: 'Failed to upload report.' }, { status: 500 });
  }
}
