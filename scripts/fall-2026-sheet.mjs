// Apply the published "Dotori School Fall 2026 Schedule & Tuition" sheet to the
// database: group class tuition and class sizes, the Wednesday timetable as the
// sheet prints it, and Mrs. Jung's private / semi-private packages.
//
// Dry run (prints every change, writes nothing):
//   node --env-file=.env.local scripts/fall-2026-sheet.mjs
// Apply:
//   node --env-file=.env.local scripts/fall-2026-sheet.mjs --apply
//
// Idempotent: re-running after an apply reports "no changes". Everything it
// writes is derived from lib/pricing.js and lib/literacySlots.js, so correcting
// a price there and re-running is the whole update.
import mongoose from 'mongoose';
import Class from '../lib/models/Class.js';
import Tutor from '../lib/models/Tutor.js';
import {
  GROUP_CLASS_TUITION,
  LESSON_FORMATS,
  LESSON_PACKAGES,
  TERM,
  formatUsd,
  packsForTutor,
} from '../lib/pricing.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}
const apply = process.argv.slice(2).includes('--apply');

// The instructor the sheet's private & semi-private table belongs to.
const TUTOR_SLUG = 'yesol-jung';

// The Fall 2026 timetable, one entry per slot on the printed grid. `tuition` is
// a GROUP_CLASS_TUITION id; `max` is the class size the sheet publishes.
const GRID = [
  { key: 'mon-core-acorn',   name: 'Core Literacy (Acorn) - Mon',            category: 'reading', schedule: 'Mon 4:30-5:50', max: 4, tuition: 'core-literacy' },
  { key: 'mon-book-sapling', name: 'Book Club (Sapling) - Mon',              category: 'reading', schedule: 'Mon 6:00-7:20', max: 5, tuition: 'book-club' },
  { key: 'tue-core-sprout',  name: 'Core Literacy (Sprout) - Tue',           category: 'reading', schedule: 'Tue 4:30-5:50', max: 5, tuition: 'core-literacy' },
  { key: 'tue-core-sapling', name: 'Core Literacy (Sapling) - Tue',          category: 'reading', schedule: 'Tue 6:00-7:20', max: 5, tuition: 'core-literacy' },
  { key: 'wed-korean-lev3',  name: 'Korean Phonics (Hangeul) Lev.3 - Wed',   category: 'korean',  schedule: 'Wed 2:30-3:50', max: 4, tuition: 'korean-phonics' },
  { key: 'wed-book-sprout',  name: 'Book Club (Sprout) - Wed',               category: 'reading', schedule: 'Wed 4:00-5:20', max: 5, tuition: 'book-club' },
  { key: 'wed-book-sapling', name: 'Book Club (Sapling) - Wed',              category: 'reading', schedule: 'Wed 6:00-7:20', max: 5, tuition: 'book-club' },
  { key: 'thu-book-sprout',  name: 'Book Club (Sprout) - Thu',               category: 'reading', schedule: 'Thu 4:30-5:50', max: 5, tuition: 'book-club' },
  { key: 'thu-core-oak',     name: 'Core Literacy (Oak) - Thu',              category: 'reading', schedule: 'Thu 6:00-7:20', max: 5, tuition: 'core-literacy' },
  { key: 'fri-book-acorn',   name: 'Book Club (Acorn) - Fri',                category: 'reading', schedule: 'Fri 4:30-5:50', max: 4, tuition: 'book-club' },
  { key: 'fri-book-oak',     name: 'Book Club (Oak) - Fri',                  category: 'reading', schedule: 'Fri 6:00-7:20', max: 5, tuition: 'book-club' },
];

// Mrs. Jung's price list, built from the sheet's two-format table rather than
// retyped: every figure here is already in lib/pricing.js, and a package that
// disagreed with the published table would be a second source of truth.
const RATES = LESSON_FORMATS.flatMap((format) =>
  LESSON_PACKAGES.map((pkg) => {
    const row = pkg.rates[format.id];
    // The sheet quotes both a per-hour rate and a total hours figure. They have
    // to agree, or the package sells a different amount of teaching than the
    // table promises — so check rather than trust.
    const derived = pkg.sessions * format.hoursPerSession;
    if (Math.abs(derived - row.hours) > 1e-9) {
      throw new Error(
        `${format.name} / ${pkg.name}: ${pkg.sessions} × ${format.hoursPerSession}h = ${derived}h, but the table says ${row.hours}h.`,
      );
    }
    return {
      sessions: pkg.sessions,
      ratePerHour: row.ratePerHour,
      hoursPerSession: format.hoursPerSession,
      name: `${format.name} · ${pkg.name}`,
      tag: pkg.blurb,
      validMonths: pkg.validMonths,
    };
  }),
);

const changes = [];
const note = (line) => changes.push(line);

await mongoose.connect(uri, { bufferCommands: false });

// ── Group classes ────────────────────────────────────────────────────
const existing = await Class.find({ quarter: TERM.slug });
const byKey = new Map(existing.map((c) => [c.scheduleKey, c]));

for (const slot of GRID) {
  const tuition = GROUP_CLASS_TUITION.find((t) => t.id === slot.tuition);
  const price = tuition.priceCents / 100;
  const materialsFee = tuition.materialsFeeCents / 100;
  const cls = byKey.get(slot.key);

  if (!cls) {
    note(`+ CREATE  ${slot.name} · ${slot.schedule} · ${slot.max} max · ${formatUsd(tuition.priceCents)}`);
    if (apply) {
      await Class.create({
        name: slot.name,
        category: slot.category,
        quarter: TERM.slug,
        schedule: slot.schedule,
        price,
        materialsFee,
        capacity: slot.max,
        scheduleKey: slot.key,
        active: true,
      });
    }
    continue;
  }

  const diff = [];
  if (cls.price !== price) diff.push(`price ${cls.price} → ${price}`);
  if ((cls.materialsFee || 0) !== materialsFee) diff.push(`materials ${cls.materialsFee || 0} → ${materialsFee}`);
  if (cls.capacity !== slot.max) diff.push(`capacity ${cls.capacity} → ${slot.max}`);
  if (cls.schedule !== slot.schedule) diff.push(`schedule "${cls.schedule}" → "${slot.schedule}"`);
  if (cls.active !== true) diff.push('active false → true');
  if (diff.length === 0) continue;

  note(`~ UPDATE  ${cls.name}: ${diff.join(', ')}`);
  if (apply) {
    cls.price = price;
    cls.materialsFee = materialsFee;
    cls.capacity = slot.max;
    cls.schedule = slot.schedule;
    cls.active = true;
    await cls.save();
  }
}

// A class in this term that the sheet does not print is retired, not deleted:
// its enrollments, invoices and reports still point at it.
const printed = new Set(GRID.map((s) => s.key));
for (const cls of existing) {
  if (printed.has(cls.scheduleKey) || cls.active === false) continue;
  note(`- RETIRE  ${cls.name} (${cls.schedule || 'no schedule'}) — not on the Fall 2026 sheet`);
  if (apply) {
    cls.active = false;
    await cls.save();
  }
}

// ── Mrs. Jung's private & semi-private packages ──────────────────────
const tutor = await Tutor.findOne({ slug: TUTOR_SLUG });
if (!tutor) {
  console.error(`\nNo tutor with slug "${TUTOR_SLUG}" — skipping the lesson packages.`);
} else {
  const same =
    (tutor.rates || []).length === RATES.length &&
    RATES.every((r, i) => {
      const cur = tutor.rates[i];
      return (
        cur &&
        cur.sessions === r.sessions &&
        cur.ratePerHour === r.ratePerHour &&
        (cur.hoursPerSession ?? null) === r.hoursPerSession &&
        (cur.name || '') === r.name &&
        (cur.tag || '') === r.tag &&
        (cur.validMonths ?? null) === r.validMonths
      );
    });

  if (!same) {
    note(`~ RATES   ${tutor.name}: ${(tutor.rates || []).length} package(s) → ${RATES.length}`);
    if (apply) {
      tutor.rates = RATES;
      await tutor.save();
    }
    // Priced through the same function the family portal quotes from, so this
    // is the actual checkout total and not a second calculation of it.
    for (const p of packsForTutor({ rates: RATES })) {
      note(`            ${p.name} — ${formatUsd(p.amountCents)} (${p.lines.join(' · ')})`);
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────
console.log(`\nFall Quarter 2026 sheet · ${apply ? 'APPLYING' : 'DRY RUN'}\n`);
if (changes.length === 0) {
  console.log('  Nothing to change — the database already matches the sheet.');
} else {
  for (const line of changes) console.log('  ' + line);
  if (!apply) console.log('\n  Nothing was written. Re-run with --apply to make these changes.');
}
console.log('');

await mongoose.disconnect();
