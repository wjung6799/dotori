import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */

// The frontend was reactified but the Express API + MongoDB backend is kept as-is.
// All pages call relative `/api/*` endpoints. In dev/prod we proxy those to the
// running Express server via API_BASE_URL (e.g. http://localhost:3003 locally, or
// your deployed backend URL on Vercel). If unset, /api calls 404 — set it before
// expecting auth/shop/contact features to work.
const API_BASE_URL = process.env.API_BASE_URL;

const nextConfig = {
  // This app lives in a subfolder of a repo that also has the Express backend's
  // package-lock.json. Pin the tracing root to this folder so Next doesn't warn
  // about multiple lockfiles. (On Vercel, set the project Root Directory to
  // `dotori-next` and this is a no-op.)
  outputFileTracingRoot: import.meta.dirname,
  // The app is JS with a partial TS layer (Payload). Don't fail the build on
  // type errors from the mixed codebase during this POC.
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    if (!API_BASE_URL) return [];
    // NOTE: /api/* is no longer rewritten here — it goes through the catch-all
    // route handler (app/api/[...path]/route.js), which attaches the
    // authenticated identity before proxying to Express. Only static uploads
    // are proxied directly.
    return [
      { source: '/uploads/:path*', destination: `${API_BASE_URL}/uploads/:path*` },
    ];
  },
};

export default withPayload(nextConfig);
