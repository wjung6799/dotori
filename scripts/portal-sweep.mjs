// Run the dev server first, then:
//   node --env-file=.env.local scripts/portal-sweep.mjs [baseUrl]
//
// Renders every portal page as a family, a tutor and an admin, and fails on any
// that errors. `next build` cannot catch a missing import inside a client
// component — this can, because it actually renders the page.
import { registerHooks } from 'node:module';
const ROOT = 'file:///Users/wjung/Desktop/dotori';
registerHooks({ resolve(s, c, n) {
  if (!s.startsWith('@/')) return n(s, c);
  const r = s.slice(2); return n(`${ROOT}/${/\.[a-z]+$/.test(r) ? r : `${r}.js`}`, c);
} });
const { encode } = await import('next-auth/jwt');
const { default: mongoose } = await import('mongoose');
const { default: dbConnect } = await import('@/lib/db.js');
const { default: User } = await import('@/lib/models/User.js');

const BASE = process.argv[2] || 'http://localhost:3100';
const COOKIE = 'authjs.session-token';
await dbConnect();

// Discovered from the filesystem, so a new page is swept the day it is added
// and a renamed one cannot quietly drop out of the check.
const { readdirSync } = await import('node:fs');
function routes(dir, prefix = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name.startsWith('[')) continue; // needs an id; not a blanket sweep
      out.push(...routes(`${dir}/${e.name}`, `${prefix}/${e.name}`));
    } else if (e.name === 'page.jsx') out.push(prefix || '/');
  }
  return out;
}
const all = routes('app/(portal)').sort();
const PAGES = {
  family: all.filter((p) => p.startsWith('/dashboard')),
  tutor: all.filter((p) => p.startsWith('/tutor')),
  admin: all.filter((p) => p.startsWith('/admin')),
};

let bad = 0;
for (const [role, pages] of Object.entries(PAGES)) {
  const u = await User.findOne(role === 'family' ? { $or: [{ role: 'family' }, { role: { $exists: false } }] } : { role }).lean();
  if (!u) { console.log(`\n${role}: no such user in this db — skipped`); continue; }
  const jwt = await encode({
    token: { id: String(u._id), sub: String(u._id), role, name: u.name || role, email: u.email },
    secret: process.env.AUTH_SECRET, salt: COOKIE, maxAge: 3600,
  });
  console.log(`\n${role}  (${u.email})`);
  for (const p of pages) {
    let line;
    try {
      const res = await fetch(BASE + p, { headers: { cookie: `${COOKIE}=${jwt}` }, redirect: 'manual' });
      const html = res.status < 400 ? await res.text() : '';
      // A client component that throws during SSR shows up as a digest, not a 500.
      const digest = /Application error|"digest":"|Internal Server Error/.test(html);
      const ok = res.status < 400 && !digest;
      if (!ok) bad++;
      line = `${ok ? 'ok  ' : 'BAD '} ${String(res.status).padEnd(3)} ${p}${digest ? '  <-- runtime error in the page' : ''}${res.status >= 300 && res.status < 400 ? `  -> ${res.headers.get('location')}` : ''}`;
    } catch (e) { bad++; line = `BAD err ${p}  ${e.message}`; }
    console.log('  ' + line);
  }
}
console.log(`\n${bad ? `${bad} page(s) need a look` : 'every page rendered clean'}`);
await mongoose.disconnect();
process.exitCode = bad ? 1 : 0;
