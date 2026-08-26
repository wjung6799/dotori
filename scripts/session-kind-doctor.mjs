// Run: node --env-file=.env.local scripts/session-kind-doctor.mjs
//
// Proves the rule the school runs on: a semi-private credit books a semi-private
// opening and nothing else. Creates its own throwaway tutor, user, slots and
// credits, and removes every one of them in the finally block.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

// The app writes imports as '@/lib/...'. That alias is a tsconfig path, which
// bare node knows nothing about, so teach the resolver the one rule it needs.
const ROOT = new URL('..', import.meta.url).href.replace(/\/$/, '');
registerHooks({
  resolve(specifier, context, next) {
    if (!specifier.startsWith('@/')) return next(specifier, context);
    // Bundler-style imports leave the extension off; node insists on it.
    const rest = specifier.slice(2);
    const url = `${ROOT}/${/\.[a-z]+$/.test(rest) ? rest : `${rest}.js`}`;
    return next(url, context);
  },
});

const { default: mongoose } = await import('mongoose');
const { default: dbConnect } = await import('@/lib/db.js');
const { default: Tutor } = await import('@/lib/models/Tutor.js');
const { default: TutorSchedule } = await import('@/lib/models/TutorSchedule.js');
const { default: SessionCredit } = await import('@/lib/models/SessionCredit.js');
const { default: Booking } = await import('@/lib/models/Booking.js');
const { attemptBooking } = await import('@/lib/booking.js');

const TAG = 'KINDTEST-' + process.pid;
const uid = new mongoose.Types.ObjectId();
let tutor, semiSlot, privSlot;

// The next occurrence of a fixed weekday, comfortably in the future.
const DOW = 3; // Wednesday
function nextDateKey() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  while (d.getDay() !== DOW) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const DATE = nextDateKey();

const results = [];
const check = (name, got, want) => {
  const ok = got === want;
  results.push({ name, ok, got, want });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}\n        got=${got} want=${want}`);
};

async function grant(sessionType, n = 1) {
  return SessionCredit.create({
    userId: uid, tutorId: tutor._id, sessionType,
    totalSessions: n, remainingSessions: n, amountCents: 0, notes: TAG,
  });
}
async function book(schedule, isPrivate = false) {
  const r = await attemptBooking({
    userId: uid, studentName: TAG, schedule, dateKey: DATE, isPrivate,
  });
  return r.ok ? 'ok' : r.code;
}
async function clearCredits() { await SessionCredit.deleteMany({ userId: uid }); }
async function clearBookings() { await Booking.deleteMany({ userId: uid }); }

try {
  await dbConnect();
  console.log(`db=${mongoose.connection.name}  testing ${DATE}\n`);

  tutor = await Tutor.create({ name: TAG, slug: TAG.toLowerCase(), active: true });
  const base = { tutorId: tutor._id, recurrence: 'weekly', dayOfWeek: DOW, active: true, kind: 'session' };
  semiSlot = await TutorSchedule.create({ ...base, startMinute: 900, capacity: 4, sessionType: 'semi_private' });
  privSlot = await TutorSchedule.create({ ...base, startMinute: 1020, capacity: 1, sessionType: 'private' });
  // No sessionType at all — the shape of every slot opened before kinds existed.
  const legacySlot = await TutorSchedule.create({ ...base, startMinute: 1140, capacity: 1 });

  console.log('A semi-private credit:');
  await grant('semi_private');
  check('cannot book a private opening', await book(privSlot), 'no_credit');
  check('books the semi-private opening', await book(semiSlot), 'ok');
  await clearCredits(); await clearBookings();

  console.log('\nA private credit:');
  await grant('private');
  check('cannot book a semi-private opening', await book(semiSlot), 'no_credit');
  check('books the private opening', await book(privSlot), 'ok');
  await clearCredits(); await clearBookings();

  console.log('\nA legacy credit with no kind on it (bought before kinds existed):');
  await grant(null, 2);
  check('still books semi-private', await book(semiSlot), 'ok');
  check('still books private', await book(privSlot), 'ok');
  await clearCredits(); await clearBookings();

  console.log('\nA slot the tutor never marked (guessed private from its one seat):');
  await grant('semi_private');
  check('is not refused over the guess', await book(legacySlot), 'ok');
  await clearCredits(); await clearBookings();

  console.log('\nWhole-slot buyout (isPrivate) — the untouched feature:');
  await grant('semi_private', 2);
  check('takes the whole semi-private slot for 2', await book(semiSlot, true), 'ok');
  const left = await SessionCredit.findOne({ userId: uid });
  check('and it really charged 2', String(left.remainingSessions), '0');
  await clearCredits(); await clearBookings();

  console.log('\nOne credit is not enough to buy out a slot:');
  await grant('semi_private', 1);
  check('buyout refused at 1 credit', await book(semiSlot, true), 'no_credit');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
} finally {
  await SessionCredit.deleteMany({ userId: uid });
  await Booking.deleteMany({ userId: uid });
  if (semiSlot || privSlot) await TutorSchedule.deleteMany({ tutorId: tutor._id });
  if (tutor) await Tutor.deleteOne({ _id: tutor._id });
  console.log('cleaned up');
  await mongoose.disconnect();
}
