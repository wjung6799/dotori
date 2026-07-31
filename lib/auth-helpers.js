import { auth } from '@/auth';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

// Replaces the Express requireAuth / requireAdmin middleware. The identity now
// comes from the Auth.js session (JWT) instead of express-session, so there is
// no x-auth-user-id bridge anymore; these run inside the Next.js route itself.

// Returns the Mongoose User doc for the signed-in user, or null.
export async function getCurrentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  await dbConnect();
  try {
    return await User.findById(id).select('-passwordHash');
  } catch {
    return null; // malformed id, etc.
  }
}

// Returns the admin User doc, or null if not signed in / not an admin.
export async function getAdminUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

// Returns the User doc if they're a tutor or admin, else null.
export async function getTutorOrAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'tutor' && user.role !== 'admin')) return null;
  return user;
}

// Standard JSON 401/403 responses for route handlers.
export function unauthorized() {
  return Response.json({ error: 'Not authenticated' }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: 'Admin access required' }, { status: 403 });
}
