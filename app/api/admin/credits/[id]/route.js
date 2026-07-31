import dbConnect from '@/lib/db';
import SessionCredit from '@/lib/models/SessionCredit';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// DELETE /api/admin/credits/:id: remove a session grant.
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    await SessionCredit.findByIdAndDelete(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Admin credit delete error:', err);
    return Response.json({ error: 'Failed to remove sessions.' }, { status: 500 });
  }
}
