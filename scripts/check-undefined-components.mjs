// Catch a JSX component used without importing or defining it.
//
// `next build` does NOT catch this: <Link/> with no import is a valid identifier
// reference that only throws when the component renders, so the build passes and
// the page dies in front of whoever opens it. That happened once here already.
//
//   node scripts/check-undefined-components.mjs
import fs from 'node:fs';
import path from 'node:path';

const roots = ['app/(portal)', 'components'];
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.jsx?$/.test(e.name)) files.push(f);
  }
};
roots.forEach((r) => fs.existsSync(r) && walk(r));

const GLOBALS = new Set(['React','Math','Date','Number','String','Boolean','Object','Array','JSON','Set','Map','Promise','window','document','console','fetch','setTimeout','clearTimeout','setInterval','clearInterval','URLSearchParams','Intl','Error','isNaN','parseInt','parseFloat','Infinity','NaN','process','Stripe','Fragment']);

let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // Capitalised JSX tags: <Foo ...>
  const used = new Set([...src.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)].map((m) => m[1]));
  // Anything imported, declared, or defined in this file
  const defined = new Set();
  for (const m of src.matchAll(/import\s+([A-Za-z0-9_]+)\s*,?\s*(?:\{([^}]*)\})?\s*from/g)) {
    if (m[1]) defined.add(m[1]);
    if (m[2]) m[2].split(',').forEach((x) => defined.add(x.trim().split(/\s+as\s+/).pop().trim()));
  }
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g))
    m[1].split(',').forEach((x) => defined.add(x.trim().split(/\s+as\s+/).pop().trim()));
  for (const m of src.matchAll(/(?:function|const|let|class)\s+([A-Za-z0-9_]+)/g)) defined.add(m[1]);

  const missing = [...used].filter((u) => !defined.has(u) && !GLOBALS.has(u));
  if (missing.length) { console.log(f, '->', missing.join(', ')); bad++; }
}
console.log(bad === 0 ? '\n✓ every JSX component used is imported or defined in its own file' : `\n${bad} file(s) with an undefined component`);
