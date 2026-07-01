import dbConnect from '@/lib/db';
import Tutor from '@/lib/models/Tutor';
import { getTutorOrAdmin } from '@/lib/auth-helpers';

// Resolve the Tutor profile linked to the signed-in tutor/admin. `user` is null
// if not authorized; `tutor` is null if no profile is linked to their account.
export async function getMyTutor() {
  const user = await getTutorOrAdmin();
  if (!user) return { user: null, tutor: null };
  await dbConnect();
  const tutor = await Tutor.findOne({ userId: user._id });
  return { user, tutor };
}

export function notTutor() {
  return Response.json(
    { error: 'No tutor profile is linked to your account.' },
    { status: 403 },
  );
}
