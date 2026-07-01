import dbConnect from '@/lib/db';
import { pollLuluOrders } from '@/lib/luluClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/cron/poll-lulu — invoked hourly by Vercel Cron (see vercel.json).
// Replaces the Express setInterval poller. Vercel sends an Authorization bearer
// equal to CRON_SECRET; we reject anything else so the route isn't public.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // No Lulu creds → nothing to poll; succeed quietly.
  if (!process.env.LULU_CLIENT_KEY) {
    return Response.json({ ok: true, skipped: 'LULU_CLIENT_KEY not set' });
  }

  await dbConnect();
  await pollLuluOrders();
  return Response.json({ ok: true });
}
