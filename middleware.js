import NextAuth from 'next-auth';
import authConfig from '@/auth.config';

// Edge middleware that protects /dashboard, /profile, /admin and /tutor using
// the `authorized` callback in auth.config.js. Uses only the edge-safe config
// (no Mongo/bcrypt).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Run on the Node.js runtime (not Edge): next-auth pulls in `jose`, which uses
  // DecompressionStream, unsupported in the Edge Runtime. Node middleware is
  // stable as of Next.js 15.5.
  runtime: 'nodejs',
  matcher: ['/dashboard/:path*', '/profile/:path*', '/admin/:path*', '/tutor/:path*'],
};
