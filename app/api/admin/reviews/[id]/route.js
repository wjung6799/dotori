import dbConnect from '@/lib/db';
import Review from '@/lib/models/Review';
import { getAdminUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/admin/reviews/:id — toggle approval ({ approved: true|false }).
export async function PUT(request, { params }) {
  if (!(await getAdminUser())) return unauthorized();
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  await dbConnect();
  const review = await Review.findByIdAndUpdate(id, { approved: !!body?.approved }, { new: true });
  if (!review) return Response.json({ error: 'Review not found.' }, { status: 404 });
  return Response.json({ ok: true, review });
}

// DELETE /api/admin/reviews/:id — remove a review entirely.
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return unauthorized();
  const { id } = await params;
  await dbConnect();
  await Review.findByIdAndDelete(id);
  return Response.json({ ok: true });
}
