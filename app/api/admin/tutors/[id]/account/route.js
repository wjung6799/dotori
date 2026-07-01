import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import Tutor from '@/lib/models/Tutor';
import User from '@/lib/models/User';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// POST /api/admin/tutors/:id/account — give a tutor profile a login.
// body: { email, password? }
//  - if a user with that email exists → promote them to role 'tutor' (password ignored)
//  - else → create a new 'tutor' login (password required)
export async function POST(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    const { email: rawEmail, password } = (await request.json()) || {};
    const email = rawEmail?.toString().trim().toLowerCase();
    if (!email) return Response.json({ error: 'Email is required.' }, { status: 400 });

    await dbConnect();
    const tutor = await Tutor.findById(id);
    if (!tutor) return Response.json({ error: 'Tutor not found.' }, { status: 404 });

    let user = await User.findOne({ email });
    let created = false;
    if (user) {
      user.role = 'tutor';
      await user.save();
    } else {
      if (!password || password.length < 8) {
        return Response.json(
          { error: 'No account with that email — provide a password (8+ chars) to create one.' },
          { status: 400 },
        );
      }
      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({
        email,
        passwordHash,
        name: tutor.name,
        firstName: tutor.name,
        role: 'tutor',
      });
      created = true;
    }

    tutor.userId = user._id;
    await tutor.save();

    return Response.json({ ok: true, created, userId: user._id, email });
  } catch (err) {
    if (err.code === 11000) {
      return Response.json({ error: 'That email is already in use.' }, { status: 400 });
    }
    console.error('Tutor account link error:', err);
    return Response.json({ error: 'Failed to set up the tutor login.' }, { status: 500 });
  }
}

// DELETE /api/admin/tutors/:id/account — unlink the login (optionally demote).
export async function DELETE(request, { params }) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const { id } = await params;
    await dbConnect();
    const tutor = await Tutor.findById(id);
    if (!tutor) return Response.json({ error: 'Tutor not found.' }, { status: 404 });
    if (tutor.userId) {
      // Demote the linked user back to a family account.
      await User.findByIdAndUpdate(tutor.userId, { role: 'family' });
      tutor.userId = null;
      await tutor.save();
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Tutor account unlink error:', err);
    return Response.json({ error: 'Failed to unlink.' }, { status: 500 });
  }
}
