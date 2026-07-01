import NextAuth from 'next-auth';
import authConfig from '@/auth.config';

// Edge middleware that protects /profile and /admin using the `authorized`
// callback in auth.config.js. Uses only the edge-safe config (no Mongo/bcrypt).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ['/profile/:path*', '/admin/:path*', '/tutor/:path*'],
};
