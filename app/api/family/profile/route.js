import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/family/profile
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ user });
}

// PUT /api/family/profile
export async function PUT(request) {
  const current = await getCurrentUser();
  if (!current) return unauthorized();

  try {
    const body = await request.json();
    const { firstName, lastName, phone, students } = body || {};
    const update = {};
    if (firstName) update.firstName = firstName.trim();
    if (lastName) update.lastName = lastName.trim();
    if (phone !== undefined) update.phone = phone;
    if (Array.isArray(students)) {
      update.students = students.filter((s) => s.name && s.name.trim());
    }

    await dbConnect();
    const user = await User.findByIdAndUpdate(current._id, update, { new: true }).select(
      '-passwordHash',
    );
    return Response.json({ ok: true, user });
  } catch (err) {
    console.error('Profile update error:', err);
    return Response.json({ error: 'Failed to update profile.' }, { status: 500 });
  }
}
