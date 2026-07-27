// Seed / inspect free-diagnostic availability slots.
//
// Dry run (list tutors + existing diagnostic slots):
//   node --env-file=.env.local scripts/diagnostic-slots.mjs
// Create the 2:00 PM / 5:30 PM / 8:00 PM weekday window:
//   node --env-file=.env.local scripts/diagnostic-slots.mjs --seed --tutor=<slug|id>
// Remove all diagnostic slots:
//   node --env-file=.env.local scripts/diagnostic-slots.mjs --clear
import mongoose from 'mongoose';
import Tutor from '../lib/models/Tutor.js';
import TutorSchedule from '../lib/models/TutorSchedule.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

const args = process.argv.slice(2);
const seed = args.includes('--seed');
const clear = args.includes('--clear');
const tutorArg = (args.find((a) => a.startsWith('--tutor=')) || '').split('=')[1];

// The window: 2:00 PM, 5:30 PM, 8:00 PM (minutes from midnight, site timezone).
const TIMES = [
  { label: '2:00 PM', startMinute: 14 * 60 },
  { label: '5:30 PM', startMinute: 17 * 60 + 30 },
  { label: '8:00 PM', startMinute: 20 * 60 },
];
const DURATION = 45; // minutes
const RECURRENCE = 'weekday'; // Mon–Fri

await mongoose.connect(uri, { bufferCommands: false });

const tutors = await Tutor.find({}).select('name slug active userId sortOrder').sort({ sortOrder: 1 }).lean();
console.log('\nTUTORS:');
for (const t of tutors) {
  console.log(`  ${t.active ? '●' : '○'} ${t.name}  slug=${t.slug}  id=${t._id}  linkedUser=${t.userId || 'none'}`);
}

const existing = await TutorSchedule.find({ kind: 'diagnostic' })
  .select('tutorId recurrence startMinute durationMinutes active')
  .lean();
console.log(`\nEXISTING DIAGNOSTIC SLOTS: ${existing.length}`);
for (const s of existing) {
  const h = Math.floor(s.startMinute / 60), m = s.startMinute % 60;
  console.log(`  tutor=${s.tutorId} ${s.recurrence} @ ${h}:${String(m).padStart(2, '0')} dur=${s.durationMinutes} active=${s.active}`);
}

if (clear) {
  const res = await TutorSchedule.deleteMany({ kind: 'diagnostic' });
  console.log(`\nCleared ${res.deletedCount} diagnostic slot(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

if (!seed) {
  console.log('\n(dry run — pass  --seed --tutor=<slug|id>  to create the 2pm/5:30pm/8pm weekday window)');
  await mongoose.disconnect();
  process.exit(0);
}

let tutor;
if (tutorArg) tutor = tutors.find((t) => t.slug === tutorArg || String(t._id) === tutorArg);
else tutor = tutors.find((t) => t.active) || tutors[0];
if (!tutor) {
  console.error('\nNo tutor found — create a tutor in the admin first.');
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`\nSeeding diagnostic window for tutor: ${tutor.name} (${tutor._id})`);

let created = 0, skipped = 0;
for (const t of TIMES) {
  const dupe = await TutorSchedule.findOne({
    tutorId: tutor._id, kind: 'diagnostic', recurrence: RECURRENCE, startMinute: t.startMinute,
  });
  if (dupe) { skipped++; console.log(`  skip ${t.label} (already exists)`); continue; }
  await TutorSchedule.create({
    tutorId: tutor._id,
    kind: 'diagnostic',
    recurrence: RECURRENCE,
    dayOfWeek: 1, // required by the schema; ignored for 'weekday' recurrence
    startMinute: t.startMinute,
    durationMinutes: DURATION,
    capacity: 1,
    subject: 'Free Diagnostic Assessment',
    active: true,
  });
  created++; console.log(`  created ${t.label}`);
}
console.log(`\nDone. created=${created} skipped=${skipped}`);
await mongoose.disconnect();
process.exit(0);
