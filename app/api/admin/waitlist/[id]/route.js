import dbConnect from '@/lib/db';
import Waitlist from '@/lib/models/Waitlist';
import { getAdminUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// DELETE /api/admin/waitlist/:id — remove an entry (e.g. after contacting the family).
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return unauthorized();
  const { id } = await params;
  await dbConnect();
  await Waitlist.findByIdAndDelete(id);
  return Response.json({ ok: true });
}
