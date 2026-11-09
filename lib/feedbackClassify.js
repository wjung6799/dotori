// Works out which class a feedback note belongs to from the header instructors
// type on its first line, e.g.
//   [Fall 2026 Sprout Book Club - Week 6]
//   [Fall - Core Literacy - Week 3]
//   [도토리 한글수업 - Week 4]
//   [10.24.26] - Private Lesson Session 5
// The header names a program (and sometimes a level), but not which section:
// "Sprout Book Club" runs Wed and Thu, "Core Literacy" four times a week. So the
// header only narrows the candidates; the student's own enrollments decide.
//
// Pure functions, no database access: callers pass the classes and the
// family's enrollments in. Used by the POST route (notes sent from the
// one-student form) and by scripts/classify-feedback.mjs (backfill).

// Monday of Week 1 for each quarter. Week N's lesson falls on the class's
// weekday in the week starting here + 7*(N-1) days.
export const QUARTER_WEEK1 = { 'fall-2026': '2026-09-21' };

const LEVELS = ['acorn', 'sprout', 'sapling', 'oak'];
const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const PROGRAMS = [
  { key: 'bookclub', header: /book\s*club|북\s*클럽/i, cls: /book\s*club/i },
  { key: 'core', header: /core\s*lit/i, cls: /core\s*literacy/i },
  { key: 'hangeul', header: /한글|hangeul|hangul|phonics/i, cls: /hangeul|korean\s*phonics/i },
  { key: 'writers', header: /writer/i, cls: /writer/i },
  { key: 'semi', header: /semi/i, cls: /semi-?private/i },
  { key: 'private', header: /private|1\s*:\s*1|과외/i, cls: /private|1\s*:\s*1/i },
];

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// The class a note falls back to when nothing else fits: the running 1:1
// private tutoring class. Notes without a class are private lessons.
export function fallbackPrivateClass(classes) {
  return classes.find((c) => c.active !== false && programOfClass(c.name) === 'private') || null;
}

export function programOfClass(name) {
  const p = PROGRAMS.find((x) => x.cls.test(name || ''));
  return p ? p.key : null;
}

export function levelOf(s) {
  const t = norm(s);
  return LEVELS.find((l) => t.includes(l)) || null;
}

export function weekdayOfClass(cls) {
  const m = String(cls.schedule || cls.name || '').match(/\b(sun|mon|tue|wed|thu|fri|sat)/i);
  if (m) return DOW[m[1].toLowerCase()];
  if (/saturday/i.test(cls.schedule || cls.name || '')) return 6;
  return null;
}

// First line, or the leading [...] block if the note starts with one.
export function parseHeader(text) {
  const t = String(text || '').trim();
  const bracket = t.match(/^\[([^\]]{1,120})\]\s*(-\s*[^\n]{0,80})?/);
  const head = bracket ? `${bracket[1]} ${bracket[2] || ''}` : t.split('\n')[0].slice(0, 120);
  const program = PROGRAMS.find((p) => p.header.test(head))?.key || null;
  const week = head.match(/week\s*(\d{1,2})/i);
  const session = head.match(/session\s*(\d{1,2})/i);
  // 10.24.26 / 10/24/26 / 10.24.2026
  const date = head.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})\b/);
  let lessonDate = null;
  if (date) {
    const y = date[3].length === 2 ? 2000 + Number(date[3]) : Number(date[3]);
    lessonDate = ymd(new Date(Date.UTC(y, Number(date[1]) - 1, Number(date[2]))));
  }
  return {
    hasHeader: Boolean(bracket),
    program,
    level: levelOf(head),
    week: week ? Number(week[1]) : null,
    session: session ? Number(session[1]) : null,
    lessonDate,
  };
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

function dowOf(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

// Pacific calendar date a note was written on.
function writtenOn(createdAt) {
  return new Date(createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

// "[11.08.16]" typed for 2026-11-08: a date in another year than the note was
// written is a year typo, so keep the month and day and use the latest year
// that doesn't put the lesson after the note.
function fixYear(lessonDate, written) {
  if (!lessonDate || lessonDate.slice(0, 4) === written.slice(0, 4)) return lessonDate;
  const fixed = `${written.slice(0, 4)}${lessonDate.slice(4)}`;
  return fixed <= written ? fixed : `${Number(written.slice(0, 4)) - 1}${lessonDate.slice(4)}`;
}

// The lesson date a note's header gives, if any, corrected for year typos and
// never after the day it was written.
export function headerLessonDate(text, createdAt) {
  const written = writtenOn(createdAt);
  const d = fixYear(parseHeader(text).lessonDate, written);
  return d && d <= written ? d : '';
}

// The class's Nth-week lesson date.
export function weekToDate(cls, week) {
  const start = QUARTER_WEEK1[cls.quarter];
  const dow = weekdayOfClass(cls);
  if (!start || dow == null || !week) return null;
  return addDays(start, 7 * (week - 1) + ((dow + 6) % 7)); // Monday-based offset
}

// Latest occurrence of the class's weekday on or before the day it was written.
function lastOccurrence(cls, createdAt) {
  const dow = weekdayOfClass(cls);
  if (dow == null) return null;
  const day = writtenOn(createdAt);
  return addDays(day, -((dowOf(day) - dow + 7) % 7));
}

// Does the note's student name refer to this enrollment's student?
// "Jane" ↔ "Jane Heo", "jaiden chang" ↔ "Jaiden Chang".
export function sameStudent(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const fx = x.split(' ')[0];
  const fy = y.split(' ')[0];
  return fx === fy && (x.startsWith(y) || y.startsWith(x) || fx.length >= 3);
}

/**
 * @param note        { text, studentName, createdAt }
 * @param enrollments the family's enrollments (any quarter), each { _id, classId, studentName }
 * @param classesById Map(String(classId) → class doc)
 * @param hasNote     optional ({ classId, studentName, lessonDate }) → bool: does
 *                    that student already have a note for that lesson? Guards the
 *                    sibling switch above; without it the switch always applies.
 * @returns { classId, lessonDate, studentName, how } or { classId: null, why }
 */
export function classifyNote(note, enrollments, classesById, hasNote = null) {
  const h = parseHeader(note.text);

  if (!h.program && !h.hasHeader) return { classId: null, why: 'no header' };
  if (!enrollments.length) return { classId: null, why: 'family has no enrollment' };

  // Seats that fit the header's program (and level, when it names one).
  const fits = (seats) => {
    let out = seats.map((e) => ({ e, c: classesById.get(String(e.classId)) })).filter((x) => x.c);
    if (h.program) {
      // "Private" in a header also covers the Saturday semi-private seat.
      const want = h.program === 'private' ? ['private', 'semi'] : [h.program];
      out = out.filter((x) => want.includes(programOfClass(x.c.name)));
    }
    if (h.level) {
      const lv = out.filter((x) => levelOf(x.c.name) === h.level);
      if (lv.length) out = lv;
    }
    return out;
  };

  // The student's own seats first. When the note's name doesn't match any
  // enrollment ("테오" on the note, "Theo Park" on the seat), fall back to the
  // family's seats in that program, but only if they belong to one child, so
  // a sibling's class is never guessed.
  let cands = fits(enrollments.filter((e) => sameStudent(e.studentName, note.studentName)));

  // The header names a level the named child isn't in, but a sibling is
  // ("[Fall 2026 Oak Book Club - Week 4]" saved under Nuri, Acorn, when
  // Ashton is the one in Oak): the wrong child was picked from the list, so
  // the header wins. Only when it points at exactly one child, and only when
  // that child has no note of their own for the lesson yet; if they do, the
  // header is the typo ("Sprout" typed on Ein's Sapling note while Jane got
  // her own Sprout note that day).
  if (h.level && !cands.some((x) => levelOf(x.c.name) === h.level)) {
    const sib = fits(enrollments).filter((x) => levelOf(x.c.name) === h.level);
    const kids = new Set(sib.map((x) => norm(x.e.studentName)));
    if (kids.size === 1) {
      const { e, c } = sib[0];
      const date = h.lessonDate || (h.week ? weekToDate(c, h.week) : null);
      if (!hasNote || !hasNote({ classId: c._id, studentName: e.studentName, lessonDate: date })) cands = sib;
    }
  }

  if (!cands.length) {
    const any = fits(enrollments);
    const kids = new Set(any.map((x) => norm(x.e.studentName)));
    if (kids.size === 1) cands = any;
    else if (kids.size > 1) return { classId: null, why: 'name matches no child' };
  }
  if (cands.length > 1 && h.lessonDate) {
    const d = dowOf(h.lessonDate);
    const same = cands.filter((x) => weekdayOfClass(x.c) === d);
    if (same.length) cands = same;
  }
  if (cands.length > 1) {
    // Notes are usually written the day of class or the day after.
    const day = dowOf(writtenOn(note.createdAt));
    const near = cands.filter((x) => {
      const w = weekdayOfClass(x.c);
      return w === day || (w + 1) % 7 === day;
    });
    if (near.length) cands = near;
  }
  if (cands.length !== 1) {
    return { classId: null, why: cands.length ? 'more than one matching class' : 'no matching class' };
  }

  const { e, c } = cands[0];
  let lessonDate = h.lessonDate || (h.week ? weekToDate(c, h.week) : null);
  // A computed date after the note was written means the week count is off
  // (or the quarter start is wrong); fall back to the last class day.
  const written = writtenOn(note.createdAt);
  lessonDate = fixYear(lessonDate, written);
  if (lessonDate && lessonDate > written) lessonDate = null;
  if (!lessonDate) lessonDate = lastOccurrence(c, note.createdAt) || '';
  return {
    classId: c._id,
    lessonDate,
    studentName: e.studentName,
    how: [h.program || 'enrollment', h.level, h.week ? `week ${h.week}` : h.lessonDate].filter(Boolean).join(' · '),
  };
}
