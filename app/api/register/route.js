import bcrypt from 'bcryptjs';
import clientPromise from '@/lib/mongodb';

// POST /api/register: create an email/password user, then the client signs them
// in via the Credentials provider. (Filesystem route; takes precedence over the
// /api/* proxy rewrite, so this is handled by Next, not the Express backend.)
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name = body?.name?.toString().trim();
  const email = body?.email?.toString().trim().toLowerCase();
  const password = body?.password?.toString();

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  try {
    const db = (await clientPromise).db();
    const users = db.collection('users');

    const existing = await users.findOne({ email });
    if (existing) {
      return Response.json({ error: 'An account with that email already exists.' }, { status: 409 });
    }

    // Split the single signup name field into first/last for the family/admin
    // views (which key off firstName/lastName). Falls back gracefully.
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');

    const passwordHash = await bcrypt.hash(password, 10);
    await users.insertOne({
      name: name || null,
      firstName,
      lastName,
      phone: '',
      students: [],
      email,
      passwordHash,
      role: 'family',
      emailVerified: null,
      createdAt: new Date(),
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('register error:', err);
    return Response.json({ error: 'Could not create account. Please try again.' }, { status: 500 });
  }
}
