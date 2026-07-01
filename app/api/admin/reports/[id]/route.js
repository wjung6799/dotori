import { del } from '@vercel/blob';
import dbConnect from '@/lib/db';
import Report from '@/lib/models/Report';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE /api/admin/reports/:id — remove the report and its Blob PDF.
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();

  try {
    const { id } = await params;
    await dbConnect();
    const report = await Report.findByIdAndDelete(id);
    if (report?.pdfPath && report.pdfPath.startsWith('http')) {
      try {
        await del(report.pdfPath);
      } catch (blobErr) {
        console.error('Blob delete failed:', blobErr.message);
      }
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Report delete error:', err);
    return Response.json({ error: 'Failed to delete report.' }, { status: 500 });
  }
}
