export const dynamic = 'force-dynamic';

// GET /api/config/stripe-key — expose the Stripe publishable key to the frontend.
export async function GET() {
  return Response.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '' });
}
