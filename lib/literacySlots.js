// The slots of the public literacy weekly schedule (app/(site)/programs/
// LiteracyClient.jsx). A Class doc with a matching scheduleKey feeds that
// slot's live "enrolled/capacity" count; keys are also used by the admin
// class form. Keep in sync with the WEEK data in LiteracyClient.
//
// This is the Fall Quarter 2026 sheet. K–1 Phonics and Writer's Workshop are
// not offered this quarter, so their keys are gone from the timetable — the
// course cards on the programs page still describe them, because the school
// still teaches them, just not in this term's grid.
export const LITERACY_SLOTS = [
  { key: 'mon-core-acorn', label: 'Mon · Core Literacy (Acorn) K–1 · 4:30–5:50' },
  { key: 'mon-book-sapling', label: 'Mon · Book Club (Sapling) Gr. 4–5 · 6:00–7:20' },
  { key: 'tue-core-sprout', label: 'Tue · Core Literacy (Sprout) Gr. 2–3 · 4:30–5:50' },
  { key: 'tue-core-sapling', label: 'Tue · Core Literacy (Sapling) Gr. 4–5 · 6:00–7:20' },
  { key: 'wed-korean-lev3', label: 'Wed · Korean Phonics (Hangeul) Lev.3 K–1 · 2:30–3:50' },
  { key: 'wed-book-sprout', label: 'Wed · Book Club (Sprout) Gr. 2–3 · 4:00–5:20' },
  { key: 'wed-book-sapling', label: 'Wed · Book Club (Sapling) Gr. 4–5 · 6:00–7:20' },
  { key: 'thu-book-sprout', label: 'Thu · Book Club (Sprout) Gr. 2–3 · 4:30–5:50' },
  { key: 'thu-core-oak', label: 'Thu · Core Literacy (Oak) Gr. 6–8 · 6:00–7:20' },
  { key: 'fri-book-acorn', label: 'Fri · Book Club (Acorn) K–1 · 4:30–5:50' },
  { key: 'fri-book-oak', label: 'Fri · Book Club (Oak) Gr. 6–8 · 6:00–7:20' },
];
