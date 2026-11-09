// Backfill: give every feedback note without a class its classId, lessonDate
// and the enrollment's spelling of the student's name, using the header the
// instructor typed on its first line (see lib/feedbackClassify.js).
//
//   node --env-file=.env.local scripts/classify-feedback.mjs --db dotori_prodcopy          # dry run
//   node --env-file=.env.local scripts/classify-feedback.mjs --db dotori_prodcopy --apply
//
// Production (`test`) additionally needs --i-mean-production.
import { MongoClient } from 'mongodb';
import { classifyNote, sameStudent } from '../lib/feedbackClassify.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const dbName = opt('--db');
const apply = flag('--apply');
if (!dbName) {
  console.error('Pass --db <name> (e.g. dotori_prodcopy).');
  process.exit(1);
}
if (apply && dbName === 'test' && !flag('--i-mean-production')) {
  console.error('Refusing to write to production without --i-mean-production.');
  process.exit(1);
}

const client = await MongoClient.connect(process.env.MONGODB_URI);
const db = client.db(dbName);
try {
  const classes = await db.collection('classes').find().toArray();
  const byId = new Map(classes.map((c) => [String(c._id), c]));
  const enrollments = await db
    .collection('enrollments')
    .find({ paymentStatus: { $ne: 'refunded' } })
    .toArray();
  const byFamily = new Map();
  for (const e of enrollments) {
    const k = String(e.userId);
    if (!byFamily.has(k)) byFamily.set(k, []);
    byFamily.get(k).push(e);
  }

  const notes = await db.collection('feedbacks').find().sort({ createdAt: 1 }).toArray();
  const ops = [];
  const unresolved = [];
  const renamed = [];
  const perClass = {};
  for (const n of notes) {
    const fam = byFamily.get(String(n.userId)) || [];
    if (n.classId) {
      // Already filed: only line the name up with the enrollment.
      const seat = fam.find(
        (e) => String(e.classId) === String(n.classId) && sameStudent(e.studentName, n.studentName),
      );
      if (seat && seat.studentName !== n.studentName) {
        renamed.push(`${n.studentName} → ${seat.studentName}`);
        ops.push({ updateOne: { filter: { _id: n._id }, update: { $set: { studentName: seat.studentName } } } });
      }
      continue;
    }
    const r = classifyNote(n, fam, byId);
    if (!r.classId) {
      unresolved.push({ n, why: r.why });
      continue;
    }
    const name = byId.get(String(r.classId)).name;
    perClass[name] = (perClass[name] || 0) + 1;
    if (r.studentName !== n.studentName) renamed.push(`${n.studentName} → ${r.studentName}`);
    ops.push({
      updateOne: {
        filter: { _id: n._id, classId: null },
        update: { $set: { classId: r.classId, lessonDate: r.lessonDate, studentName: r.studentName } },
      },
    });
  }

  const already = notes.filter((n) => n.classId).length;
  console.log(`db=${dbName}  notes=${notes.length}  already filed=${already}`);
  console.log(`newly filed: ${Object.values(perClass).reduce((a, b) => a + b, 0)}`);
  for (const [k, v] of Object.entries(perClass).sort()) console.log(`  ${String(v).padStart(3)}  ${k}`);
  const uniq = [...new Set(renamed)];
  console.log(`\nname fixes (${renamed.length} notes): ${uniq.join(', ') || 'none'}`);
  console.log(`\nleft unfiled: ${unresolved.length}`);
  const why = {};
  for (const u of unresolved) why[u.why] = (why[u.why] || 0) + 1;
  for (const [k, v] of Object.entries(why)) console.log(`  ${String(v).padStart(3)}  ${k}`);
  for (const { n, why: w } of unresolved) {
    const head = String(n.text || '').split('\n')[0].slice(0, 55);
    console.log(`    ${n.createdAt.toISOString().slice(0, 10)}  ${(n.studentName || '-').padEnd(16)} ${w.padEnd(28)} ${head}`);
  }

  if (apply && ops.length) {
    const res = await db.collection('feedbacks').bulkWrite(ops);
    console.log(`\nAPPLIED to ${dbName}: ${res.modifiedCount} notes updated.`);
  } else if (!apply) {
    console.log('\n(dry run — pass --apply to write)');
  }
} finally {
  await client.close();
}
