import dbConnect from '@/lib/db';
import Tutor from '@/lib/models/Tutor';
import { getAdminUser, forbidden } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/admin/tutors: all tutors (active + inactive)
export async function GET() {
  if (!(await getAdminUser())) return forbidden();
  try {
    await dbConnect();
    const tutors = await Tutor.find().sort({ sortOrder: 1, name: 1 });
    return Response.json({ tutors });
  } catch (err) {
    console.error('Admin tutors fetch error:', err);
    return Response.json({ error: 'Failed to fetch tutors.' }, { status: 500 });
  }
}

// POST /api/admin/tutors
export async function POST(request) {
  if (!(await getAdminUser())) return forbidden();
  try {
    const body = (await request.json()) || {};
    const { name, specialty, bio, active, sortOrder } = body;
    if (!name || !name.trim()) {
      return Response.json({ error: 'Name is required.' }, { status: 400 });
    }
    const slug = (body.slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    await dbConnect();
    const tutor = await Tutor.create({
      name: name.trim(),
      slug,
      specialty: specialty || '',
      bio: bio || '',
      active: active !== false,
      sortOrder: sortOrder || 0,
    });
    return Response.json({ ok: true, tutor });
  } catch (err) {
    if (err.code === 11000) {
      return Response.json({ error: 'A tutor with that name/slug already exists.' }, { status: 400 });
    }
    console.error('Tutor create error:', err);
    return Response.json({ error: 'Failed to create tutor.' }, { status: 500 });
  }
}
