# Dotori School — Next.js frontend

A React (Next.js 15, App Router) reactification of the original static `public/*.html`
site. **Frontend only** — the existing Express + MongoDB API in `../api` / `../index.js`
is left untouched. All pages call the same relative `/api/*` endpoints as before.

## Pages

Converted 1:1 from the old HTML pages:

`/` `/about` `/programs` `/team` `/calendar` `/contact` `/schedule` `/store`
`/login` `/signup` `/profile` `/admin` `/checkout` `/order-confirmation`
`/order-status`, plus `/shop` → redirects to `/store`.

Shared chrome (top nav + footer) lives in `app/layout.jsx` via `components/Header.jsx`
and `components/Footer.jsx`. Global styles are in `app/globals.css` (ported from the old
`styles.css` + `profile-responsive.css`).

## Authentication (Auth.js / NextAuth v5)

The old Express session auth was removed and replaced with **Auth.js (NextAuth v5)**,
running inside this app. It supports:

- **Google** social login (OAuth)
- **Email + password** login (Credentials provider, bcrypt)

Files:

- `auth.config.js` — edge-safe config (Google provider, callbacks, route protection).
  Shared by middleware.
- `auth.js` — full config: adds the MongoDB adapter + Credentials provider (Node runtime).
- `app/api/auth/[...nextauth]/route.js` — Auth.js endpoints (`/api/auth/*`).
- `app/api/register/route.js` — `POST /api/register` creates an email/password user.
- `middleware.js` — protects `/profile` (any user) and `/admin` (role `admin`); redirects
  to `/login` otherwise.
- `components/Providers.jsx` — `SessionProvider`; the `Header` shows account / Sign Out.

Users (Google + email/password) are stored in **MongoDB** in the `users` collection.
To make someone an admin, set `role: "admin"` on their user document.

### Required env vars

Copy `.env.example` → `.env.local` and fill in:

| Var | What |
| --- | --- |
| `AUTH_SECRET` | Session signing secret. Generate: `npx auth secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client (see below) |
| `MONGODB_URI` | Mongo connection (stores users) — required for sign-in to work |
| `API_BASE_URL` | Existing Express backend, e.g. `http://localhost:3003` |

### Google OAuth setup

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID**
   (type: Web application).
2. Authorized redirect URIs:
   - dev: `http://localhost:3000/api/auth/callback/google`
   - prod: `https://YOUR_DOMAIN/api/auth/callback/google`
3. Put the client id/secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## Local development

```sh
npm install
npm run dev        # http://localhost:3000
```

The pages fetch `/api/*`. To make auth / shop / contact / admin actually work locally,
run the Express backend (from the repo root: `npm start`, default port 3003) and point
this app at it:

```sh
API_BASE_URL=http://localhost:3003 npm run dev
```

`next.config.mjs` proxies `/api/*` and `/uploads/*` to `API_BASE_URL`. If `API_BASE_URL`
is unset, those calls 404 (static marketing pages still work fine).

## Deploying to Vercel

Yes — this is fully Vercel-deployable (more natively than the old Express server).

1. In the Vercel project, set **Root Directory = `dotori-next`** (Framework preset:
   Next.js, auto-detected).
2. Set env vars: **`AUTH_SECRET`**, **`AUTH_GOOGLE_ID`**, **`AUTH_GOOGLE_SECRET`**,
   **`MONGODB_URI`**, and **`API_BASE_URL`** (where the Express API is hosted).
3. Add your production callback URL to the Google OAuth client (see above).

## Next steps / known follow-ups

- **Wire the Express data endpoints to the new session.** `family`, `classes`, and `admin`
  routes in `../api` still gate on the old `req.session` (via `middleware/auth.js`). With
  auth now in Auth.js, those endpoints don't yet know who's logged in, so the profile/admin
  *data* tabs won't load until they're updated to trust the Auth.js session (e.g. verify the
  JWT, or forward the user id). Login/signup/social login itself is fully working.
- If you later want a single Vercel deployment with no separate backend host, port the
  `../api` Express routes to Next route handlers / Vercel Functions.
