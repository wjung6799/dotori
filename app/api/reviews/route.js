import dbConnect from '@/lib/db';
import Review, { REVIEW_PROGRAMS } from '@/lib/models/Review';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// GET /api/reviews: PUBLIC. Approved reviews, newest first (optionally ?program=).
export async function GET(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const filter = { approved: true };
    const program = searchParams.get('program');
    if (program && REVIEW_PROGRAMS.includes(program)) filter.program = program;
    const reviews = await Review.find(filter)
      .select('program parentName rating text createdAt')
      .sort({ createdAt: -1 })
      .limit(500);
    return Response.json({ reviews });
  } catch (err) {
    console.error('Reviews fetch error:', err);
    return Response.json({ reviews: [] });
  }
}

// POST /api/reviews: PUBLIC. Submit a review; hidden until an admin approves it.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: bots fill it; pretend success.
  if (body?.website) return Response.json({ ok: true });

  const ip = clientIp(request);
  if (!rateLimit(`review:ip:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 }).ok) {
    return Response.json({ error: 'Too many requests. Please try again in a little while.' }, { status: 429 });
  }

  const program = body?.program?.toString();
  const parentName = body?.parentName?.toString().trim().slice(0, 80);
  const text = body?.text?.toString().trim().slice(0, 2000);
  const rating = Math.min(5, Math.max(1, Number(body?.rating) || 5));
  if (!REVIEW_PROGRAMS.includes(program) || !parentName || !text) {
    return Response.json({ error: 'Please fill in your name, program, and review.' }, { status: 400 });
  }

  try {
    await dbConnect();
    await Review.create({ program, parentName, rating, text, approved: false });
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('Review create error:', err);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
