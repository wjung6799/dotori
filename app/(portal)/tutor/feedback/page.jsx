'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import LocalTime from '../../LocalTime';
import FeedbackThread from '../../FeedbackThread';
import { sameStudent } from '@/lib/feedbackClassify';

// Family display name, always with the student name(s) attached: "Parent (Student)".
// Feedback is written about a child but addressed to the account holder, so the
// instructor needs to see both to pick the right row out of a long list.
const famName = (f) => {
  if (!f) return 'Family';
  const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
  const kids = (f.students || [])
    .map((s) => s.name)
    .filter(Boolean)
    .join(', ');
  return kids ? `${base} (${kids})` : base;
};

// The API hands back Date-ish JSON; LocalTime needs a real ISO string and would
// render "Invalid Date" for anything else, so unparseable values become null.
function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// "2026-09-24" → "Sep 24". Lesson dates are plain calendar days, so no
// timezone shifting: build the label in UTC from the parts.
function lessonLabel(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Today in Pacific time as YYYY-MM-DD, stepped back to the most recent
// occurrence of `dow` (0 = Sunday). A class that meets Thursdays defaults to
// this week's Thursday if it already happened, otherwise last week's.
function lastOccurrence(dow) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const today = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (dow === null || dow === undefined) return today.toISOString().slice(0, 10);
  const back = (today.getUTCDay() - dow + 7) % 7;
  today.setUTCDate(today.getUTCDate() - back);
  return today.toISOString().slice(0, 10);
}

// A tutor login that is not linked to an instructor profile gets a 403 with a
// plain message. Surface whatever the route said rather than a blank page.
async function readError(res, fallback) {
  try {
    const d = await res.json();
    return d.error || fallback;
  } catch {
    return fallback;
  }
}

export default function TutorFeedbackPage() {
  const [mode, setMode] = useState('class'); // 'class' | 'one'
  const [classes, setClasses] = useState(null); // null = loading
  const [families, setFamilies] = useState([]);
  const [items, setItems] = useState(null); // null = still loading
  const [loadError, setLoadError] = useState('');

  // Class-first form.
  const [classId, setClassId] = useState('');
  const [lessonDate, setLessonDate] = useState('');
  const [drafts, setDrafts] = useState({}); // enrollmentId → text
  const [openLast, setOpenLast] = useState({}); // enrollmentId → bool
  const [batchMsg, setBatchMsg] = useState(null);
  const [batchBusy, setBatchBusy] = useState(false);

  // One-student form.
  const [userId, setUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);

  // Sent list.
  const [view, setView] = useState('class'); // 'class' | 'student'
  // Drill-down position: which class and/or student is open in the sent list.
  const [drill, setDrill] = useState({ cls: null, student: null });
  // Admins who also teach can widen the list to every instructor's notes.
  const [showAll, setShowAll] = useState(false);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ text: '', studentName: '' });
  const [rowBusy, setRowBusy] = useState(null);
  const [rowMsg, setRowMsg] = useState(null); // { id, text }

  const load = useCallback(
    async (all = showAll) => {
      try {
        const res = await fetch(`/api/tutor/feedback${all ? '?all=1' : ''}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await readError(res, 'Could not load your feedback.'));
        const d = await res.json();
        setItems(d.feedback || []);
        setCanSeeAll(Boolean(d.canSeeAll));
        setLoadError('');
      } catch (err) {
        setItems([]);
        setLoadError(err.message || 'Could not load your feedback.');
      }
    },
    [showAll],
  );

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/tutor/classes', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res, 'Could not load your classes.'));
      const d = await res.json();
      setClasses(d.classes || []);
    } catch (err) {
      setClasses([]);
      setLoadError((prev) => prev || err.message);
    }
  }, []);

  useEffect(() => {
    fetch('/api/tutor/families', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, 'Could not load the family list.'));
        return res.json();
      })
      .then((d) => setFamilies(d.families || []))
      .catch((err) => setLoadError((prev) => prev || err.message));
    loadClasses();
    load();
  }, [load, loadClasses]);

  const cls = useMemo(() => (classes || []).find((c) => String(c._id) === classId) || null, [classes, classId]);

  function pickClass(id) {
    setClassId(id);
    setDrafts({});
    setOpenLast({});
    setBatchMsg(null);
    const c = (classes || []).find((x) => String(x._id) === id);
    setLessonDate(c ? lastOccurrence(c.dayOfWeek) : '');
  }

  const filled = cls ? cls.roster.filter((r) => (drafts[r.enrollmentId] || '').trim()).length : 0;

  async function sendBatch(e) {
    e.preventDefault();
    if (batchBusy || !cls || !filled) return;
    setBatchMsg(null);
    setBatchBusy(true);
    try {
      const notes = cls.roster
        .map((r) => ({
          userId: r.userId,
          studentName: r.studentName,
          text: (drafts[r.enrollmentId] || '').trim(),
        }))
        .filter((n) => n.text);
      const res = await fetch('/api/tutor/feedback/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: cls._id, lessonDate, notes }),
      });
      const d = await res.json();
      if (!res.ok) {
        setBatchMsg({ ok: false, text: d.error || 'Failed.' });
        return;
      }
      setBatchMsg({
        ok: true,
        text: `Sent ${d.saved} ${d.saved === 1 ? 'note' : 'notes'}.`,
      });
      setDrafts({});
      setOpenLast({});
      load();
      loadClasses(); // refresh "last note" on each seat
    } catch {
      setBatchMsg({
        ok: false,
        text: 'Could not reach the server. Try again.',
      });
    } finally {
      setBatchBusy(false);
    }
  }

  async function submitOne(e) {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/tutor/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, studentName, text }),
      });
      const d = await res.json();
      if (!res.ok) setMsg({ ok: false, text: d.error || 'Failed.' });
      else {
        setMsg({
          ok: true,
          text: 'Feedback sent.',
        });
        setText('');
        setStudentName('');
        load();
      }
    } catch {
      setMsg({ ok: false, text: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(it) {
    setRowMsg(null);
    setEditingId(it._id);
    setDraft({ text: it.text || '', studentName: it.studentName || '' });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({ text: '', studentName: '' });
  }

  async function saveEdit(id) {
    if (rowBusy || !draft.text.trim()) return;
    setRowBusy(id);
    setRowMsg(null);
    try {
      const res = await fetch(`/api/tutor/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: draft.text,
          studentName: draft.studentName,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setRowMsg({ id, text: d.error || 'Could not save the change.' });
        return;
      }
      // The PATCH response has no class name; keep the one already on the row.
      setItems((prev) => prev.map((it) => (it._id === id ? { ...it, ...d.feedback, className: it.className } : it)));
      cancelEdit();
    } catch {
      setRowMsg({ id, text: 'Could not reach the server. Try again.' });
    } finally {
      setRowBusy(null);
    }
  }

  async function remove(it) {
    if (rowBusy) return;
    const who = famName(famById(it.userId));
    if (!window.confirm(`Delete this note to ${who}? The family will no longer see it.`)) return;
    setRowBusy(it._id);
    setRowMsg(null);
    try {
      const res = await fetch(`/api/tutor/feedback/${it._id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setRowMsg({
          id: it._id,
          text: await readError(res, 'Could not delete the note.'),
        });
        return;
      }
      setItems((prev) => prev.filter((x) => x._id !== it._id));
      if (editingId === it._id) cancelEdit();
    } catch {
      setRowMsg({ id: it._id, text: 'Could not reach the server. Try again.' });
    } finally {
      setRowBusy(null);
    }
  }

  // Feedback rows carry only the family's id, so the name comes from the picker
  // list. A family missing from it falls back to "Family" rather than an id.
  const famById = (id) => families.find((f) => String(f._id) === String(id));

  // The sent list as a tree, so it stays readable as notes pile up over a
  // quarter. "By class" starts from the classes running now (with their
  // rosters, so a class or student with no notes yet still shows), then
  // files each note under its class and student. Notes from a class that's no
  // longer running keep their own group; notes with no class are private
  // lessons and sit under the 1:1 class. "By student" is every student's
  // notes across classes.
  // Notes stay newest-first inside each leaf.
  const tree = useMemo(() => {
    const groups = new Map();
    for (const c of classes || []) {
      groups.set(String(c._id), {
        key: String(c._id),
        label: c.name,
        live: true,
        count: 0,
        latest: null,
        students: (c.roster || []).map((s) => ({
          key: `${s.userId}|${(s.studentName || '').trim().toLowerCase()}`,
          userId: String(s.userId),
          label: s.studentName,
          sub: s.family?.name || '',
          notes: [],
          latest: null,
        })),
      });
    }

    // A note without a class is a private lesson, so it shows under the 1:1
    // private tutoring class rather than in a group of its own.
    const privateKey = String(
      (classes || []).find((c) => /private|1\s*:\s*1/i.test(c.name) && !/semi/i.test(c.name))?._id || '__none',
    );

    const students = new Map();
    for (const it of items || []) {
      const fam = famById(it.userId);
      const sKey = `${it.userId}|${(it.studentName || '').trim().toLowerCase()}`;
      const sLabel = it.studentName || famName(fam);
      const sSub = it.studentName ? famName(fam).split(' (')[0] : '';
      const cKey = it.classId ? String(it.classId) : privateKey;

      let g = groups.get(cKey);
      if (!g) {
        g = {
          key: cKey,
          label: it.classId ? it.className || 'Past class' : 'Other notes',
          live: false,
          count: 0,
          latest: null,
          students: [],
        };
        groups.set(cKey, g);
      }
      // Match the roster seat by family + name ("Jane" on an old note is
      // "Jane Heo" on the roster), else add the student to this group.
      let gs = g.students.find((x) => x.userId === String(it.userId) && sameStudent(x.label, it.studentName));
      if (!gs) {
        gs = { key: sKey, userId: String(it.userId), label: sLabel, sub: sSub, notes: [], latest: null };
        g.students.push(gs);
      }
      // A family wrote last and nobody has answered yet.
      const r = it.replies || [];
      const waiting = r.length > 0 && r[r.length - 1].from === 'family' ? 1 : 0;
      gs.notes.push(it);
      gs.waiting = (gs.waiting || 0) + waiting;
      g.waiting = (g.waiting || 0) + waiting;
      g.count += 1;
      if (!g.latest) g.latest = it.createdAt;
      if (!gs.latest) gs.latest = it.createdAt;

      let st = students.get(sKey);
      if (!st) {
        st = { key: sKey, label: sLabel, sub: sSub, notes: [], latest: null };
        students.set(sKey, st);
      }
      st.notes.push(it);
      st.waiting = (st.waiting || 0) + waiting;
      if (!st.latest) st.latest = it.createdAt;
    }

    const byLabel = (x, y) => x.label.localeCompare(y.label);
    // Running classes keep the API's order (by weekday), then past classes,
    // then the unfiled notes.
    const rank = (g) => (g.live ? 0 : g.key === '__none' ? 2 : 1);
    const classList = [...groups.values()]
      .map((g) => ({ ...g, students: [...g.students].sort(byLabel) }))
      .filter((g) => g.live || g.count > 0)
      .sort((x, y) => rank(x) - rank(y) || (x.live ? 0 : byLabel(x, y)));
    return { classes: classList, students: [...students.values()].sort(byLabel) };
    // famById reads `families`, which is why it is a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, families, classes]);

  function switchView(k) {
    setView(k);
    setDrill({ cls: null, student: null });
  }

  // A clickable list row for one level of the tree.
  function levelRow(key, label, sub, count, latest, onOpen, waiting = 0) {
    const when = iso(latest);
    return (
      <button
        key={key}
        type="button"
        className="row"
        onClick={onOpen}
        style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
      >
        <div className="main">
          <span className="strong">{label}</span>
          {sub ? (
            <span className="muted small" style={{ marginLeft: '0.45rem' }}>
              {sub}
            </span>
          ) : null}
        </div>
        <span className="muted small nowrap">
          {waiting ? (
            <span className="pill warn" style={{ marginRight: '0.45rem' }}>
              {waiting} {waiting === 1 ? 'reply' : 'replies'}
            </span>
          ) : null}
          {count} {count === 1 ? 'note' : 'notes'}
          {when ? (
            <>
              {' · '}
              <LocalTime iso={when} format="date" />
            </>
          ) : null}
          <span aria-hidden="true" style={{ marginLeft: '0.5rem' }}>
            ›
          </span>
        </span>
      </button>
    );
  }

  // "All classes › Book Club (Sprout) - Thu › Yohan Nho": every segment but the
  // last is a link back up.
  function crumbs(segments) {
    return (
      <nav
        className="small"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.7rem' }}
        aria-label="Where you are"
      >
        {segments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', gap: '0.3rem' }}>
            {i > 0 ? <span className="muted">›</span> : null}
            {seg.onClick ? (
              <button
                type="button"
                onClick={seg.onClick}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.1rem 0.45rem' }}
              >
                {seg.label}
              </button>
            ) : (
              <span className="strong" style={{ padding: '0.1rem 0' }}>
                {seg.label}
              </span>
            )}
          </span>
        ))}
      </nav>
    );
  }

  // One note row, shared by every view. In a grouped view the group heading
  // already says which student or class, so that part of the meta is dropped.
  // A family wrote last and nobody has answered yet.
  const awaitingAnswer = (it) => {
    const r = it.replies || [];
    return r.length > 0 && r[r.length - 1].from === 'family';
  };

  // Keep the list's copy of the thread in step, so the "Parent replied" pill
  // and the group counts update without a reload.
  function addReply(id, reply) {
    setItems((prev) => prev.map((x) => (x._id === id ? { ...x, replies: [...(x.replies || []), reply] } : x)));
  }

  function renderNote(it, { hideStudent = false, hideClass = false } = {}) {
    const written = iso(it.createdAt);
    const edited = iso(it.updatedAt);
    const isEditing = editingId === it._id;
    const thisBusy = rowBusy === it._id;
    const where = [hideClass ? '' : it.className, it.lessonDate ? `lesson ${lessonLabel(it.lessonDate)}` : '']
      .filter(Boolean)
      .join(' · ');
    return (
      <div className="row" key={it._id}>
        <div className="main" style={{ flex: '1 1 100%' }}>
          <div className="meta">
            {hideStudent ? null : (
              <>
                <span className="strong">{it.studentName || famName(famById(it.userId))}</span>
                {it.studentName ? ` · ${famName(famById(it.userId)).split(' (')[0]}` : ''}
              </>
            )}
            {where ? hideStudent ? <span className="strong">{where}</span> : ` · ${where}` : null}
            {showAll && it.tutorName ? ` · ${it.tutorName}` : ''}
            {written ? (
              <>
                {hideStudent && !where ? 'sent ' : ' · sent '}
                <LocalTime iso={written} format="date" />
              </>
            ) : null}
            {edited ? (
              <>
                {' · edited '}
                <LocalTime iso={edited} format="date" />
              </>
            ) : null}
            {awaitingAnswer(it) ? (
              <span className="pill warn" style={{ marginLeft: '0.45rem' }}>
                Parent replied
              </span>
            ) : null}
          </div>

          {isEditing ? (
            <div style={{ marginTop: '0.5rem' }}>
              <div className="field">
                <label htmlFor={`fb-edit-student-${it._id}`}>Student name (optional)</label>
                <input
                  id={`fb-edit-student-${it._id}`}
                  value={draft.studentName}
                  onChange={(e) => setDraft((d) => ({ ...d, studentName: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor={`fb-edit-text-${it._id}`}>Feedback</label>
                <textarea
                  id={`fb-edit-text-${it._id}`}
                  value={draft.text}
                  onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                  style={{ minHeight: 120, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={() => saveEdit(it._id)}
                  disabled={thisBusy || !draft.text.trim()}
                >
                  {thisBusy ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit} disabled={thisBusy}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mb0" style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>
                {it.text}
              </p>
              {it.canEdit ? (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    marginTop: '0.6rem',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => startEdit(it)}
                    disabled={thisBusy}
                  >
                    Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(it)} disabled={thisBusy}>
                    {thisBusy ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {!isEditing && (it.canEdit || (it.replies || []).length) ? (
            <FeedbackThread
              key={`${it._id}-${(it.replies || []).length}`}
              endpoint={`/api/tutor/feedback/${it._id}/replies`}
              viewer="tutor"
              replies={it.replies || []}
              onPosted={(reply) => addReply(it._id, reply)}
              readOnly={!it.canEdit}
            />
          ) : null}

          {rowMsg && rowMsg.id === it._id ? (
            <div className="notice err" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
              {rowMsg.text}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Feedback</h1>
          <p className="lede">
            Write notes home after a lesson. Families read them on their Reports &amp; feedback page.
          </p>
        </div>
      </div>

      {loadError ? <div className="notice warn">{loadError}</div> : null}

      <div className="card">
        <div className="card-head">
          <h2>Write feedback</h2>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {[
              ['class', 'Whole class'],
              ['one', 'One student'],
            ].map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                aria-pressed={mode === k}
                className={`btn btn-sm ${mode === k ? 'btn-accent' : 'btn-ghost'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {mode === 'class' ? (
          <form onSubmit={sendBatch}>
            <div className="grid-2" style={{ maxWidth: 720 }}>
              <div className="field">
                <label htmlFor="fb-class">Class</label>
                <select id="fb-class" value={classId} onChange={(e) => pickClass(e.target.value)} required>
                  <option value="">
                    {classes === null ? 'Loading classes…' : classes.length ? 'Select a class…' : 'No active classes'}
                  </option>
                  {(classes || []).map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                      {c.roster.length ? ` · ${c.roster.length}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="fb-date">Lesson date</label>
                <input
                  id="fb-date"
                  type="date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  disabled={!cls}
                />
                {cls?.schedule ? <p className="hint">{cls.schedule}</p> : null}
              </div>
            </div>

            {!cls ? (
              <p className="muted small mb0">
                Pick a class to see its roster. Write a note for the students who need one and leave the rest blank.
              </p>
            ) : cls.roster.length === 0 ? (
              <div className="empty">
                <span className="ico" aria-hidden="true">
                  🪑
                </span>
                <p>No one is enrolled in this class yet.</p>
              </div>
            ) : (
              <>
                <div className="stack">
                  {cls.roster.map((r) => {
                    const val = drafts[r.enrollmentId] || '';
                    const open = !!openLast[r.enrollmentId];
                    return (
                      <div className="row" key={r.enrollmentId}>
                        <div className="main" style={{ flex: '1 1 100%' }}>
                          <div
                            className="meta"
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.25rem 0.6rem',
                              alignItems: 'baseline',
                            }}
                          >
                            <span className="strong">{r.studentName}</span>
                            <span>{r.family.name}</span>
                            {r.lastNote ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ marginLeft: 'auto' }}
                                onClick={() =>
                                  setOpenLast((o) => ({
                                    ...o,
                                    [r.enrollmentId]: !open,
                                  }))
                                }
                                aria-expanded={open}
                              >
                                {open
                                  ? 'Hide last note'
                                  : `Last note${r.lastNote.lessonDate ? ` · ${lessonLabel(r.lastNote.lessonDate)}` : ''}`}
                              </button>
                            ) : (
                              <span className="pill mute" style={{ marginLeft: 'auto' }}>
                                First note
                              </span>
                            )}
                          </div>
                          {open && r.lastNote ? (
                            <p
                              className="small"
                              style={{
                                margin: '0.4rem 0 0',
                                padding: '0.5rem 0.7rem',
                                background: 'var(--surface)',
                                borderRadius: 6,
                                whiteSpace: 'pre-wrap',
                                color: 'var(--ink-2)',
                              }}
                            >
                              {r.lastNote.text}
                            </p>
                          ) : null}
                          <div className="field" style={{ margin: '0.45rem 0 0' }}>
                            <label htmlFor={`fb-note-${r.enrollmentId}`} style={{ position: 'absolute', left: -9999 }}>
                              Note for {r.studentName}
                            </label>
                            <textarea
                              id={`fb-note-${r.enrollmentId}`}
                              value={val}
                              onChange={(e) =>
                                setDrafts((d) => ({
                                  ...d,
                                  [r.enrollmentId]: e.target.value,
                                }))
                              }
                              placeholder={`How did ${r.studentName.split(' ')[0]} do today?`}
                              style={{ minHeight: 72, resize: 'vertical' }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.8rem',
                    flexWrap: 'wrap',
                    marginTop: '1rem',
                  }}
                >
                  <button type="submit" className="btn btn-accent" disabled={batchBusy || !filled || !lessonDate}>
                    {batchBusy
                      ? 'Sending…'
                      : filled
                        ? `Send ${filled} ${filled === 1 ? 'note' : 'notes'}`
                        : 'Send notes'}
                  </button>
                  <span className="muted small">
                    {filled ? `${cls.roster.length - filled} left blank` : 'Nothing written yet'}
                  </span>
                </div>
                {batchMsg ? (
                  <div
                    className={`notice ${batchMsg.ok ? 'ok' : 'err'}`}
                    style={{ marginTop: '1rem', marginBottom: 0 }}
                  >
                    {batchMsg.text}
                  </div>
                ) : null}
              </>
            )}
          </form>
        ) : (
          <form onSubmit={submitOne} style={{ maxWidth: 560 }}>
            <div className="field">
              <label htmlFor="fb-family">Family</label>
              <select id="fb-family" value={userId} onChange={(e) => setUserId(e.target.value)} required>
                <option value="">{families.length ? 'Select a family…' : 'No families to write to yet'}</option>
                {families.map((f) => (
                  <option key={f._id} value={f._id}>
                    {famName(f)} ({f.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="fb-student">Student name (optional)</label>
              <input
                id="fb-student"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Mochi"
              />
            </div>

            <div className="field">
              <label htmlFor="fb-text">Feedback</label>
              <textarea
                id="fb-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write feedback for the family…"
                required
                style={{ minHeight: 140, resize: 'vertical' }}
              />
              <p className="hint">The family sees this exactly as you type it, line breaks and all.</p>
            </div>

            <button type="submit" className="btn btn-accent" disabled={busy || !userId || !text.trim()}>
              {busy ? 'Sending…' : 'Send feedback'}
            </button>

            {msg ? (
              <div className={`notice ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: '1rem', marginBottom: 0 }}>
                {msg.text}
              </div>
            ) : null}
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{showAll ? 'All feedback' : 'Feedback you\u2019ve sent'}</h2>
          {items && (items.length > 0 || canSeeAll) ? (
            <div
              style={{
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {[
                  ['class', 'By class'],
                  ['student', 'By student'],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => switchView(k)}
                    aria-pressed={view === k}
                    className={`btn btn-sm ${view === k ? 'btn-accent' : 'btn-ghost'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {canSeeAll ? (
                <label
                  className="muted small nowrap"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={showAll}
                    onChange={(e) => {
                      setShowAll(e.target.checked);
                      setItems(null);
                      load(e.target.checked);
                    }}
                  />
                  All instructors
                </label>
              ) : null}
              <span className="muted small nowrap">
                {items.length} {items.length === 1 ? 'note' : 'notes'}
              </span>
            </div>
          ) : null}
        </div>

        {items === null ? (
          <p className="muted small mb0">Loading feedback…</p>
        ) : items.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">
              💬
            </span>
            <p>{showAll ? 'No feedback from any instructor yet.' : 'No feedback yet. Notes you send appear here.'}</p>
          </div>
        ) : view === 'class' ? (
          (() => {
            const cls = drill.cls ? tree.classes.find((c) => c.key === drill.cls) : null;
            const st = cls && drill.student ? cls.students.find((x) => x.key === drill.student) : null;
            if (!cls) {
              return (
                <div className="stack">
                  {tree.classes.map((c) =>
                    levelRow(
                      c.key,
                      c.label,
                      `${c.students.length} ${c.students.length === 1 ? 'student' : 'students'}`,
                      c.count,
                      c.latest,
                      () => setDrill({ cls: c.key, student: null }),
                      c.waiting,
                    ),
                  )}
                </div>
              );
            }
            if (!st) {
              return (
                <>
                  {crumbs([
                    { label: 'All classes', onClick: () => setDrill({ cls: null, student: null }) },
                    { label: cls.label },
                  ])}
                  {cls.students.length === 0 ? (
                    <p className="muted small mb0">No students enrolled in this class.</p>
                  ) : null}
                  <div className="stack">
                    {cls.students.map((x) =>
                      levelRow(
                        x.key,
                        x.label,
                        x.sub,
                        x.notes.length,
                        x.latest,
                        () => setDrill({ cls: cls.key, student: x.key }),
                        x.waiting,
                      ),
                    )}
                  </div>
                </>
              );
            }
            return (
              <>
                {crumbs([
                  { label: 'All classes', onClick: () => setDrill({ cls: null, student: null }) },
                  { label: cls.label, onClick: () => setDrill({ cls: cls.key, student: null }) },
                  { label: st.label },
                ])}
                {st.notes.length ? (
                  <div className="stack">
                    {st.notes.map((it) => renderNote(it, { hideStudent: true, hideClass: true }))}
                  </div>
                ) : (
                  <p className="muted small mb0">No notes for {st.label} in this class yet.</p>
                )}
              </>
            );
          })()
        ) : (
          (() => {
            const st = drill.student ? tree.students.find((x) => x.key === drill.student) : null;
            if (!st) {
              return (
                <div className="stack">
                  {tree.students.map((x) =>
                    levelRow(
                      x.key,
                      x.label,
                      x.sub,
                      x.notes.length,
                      x.latest,
                      () => setDrill({ cls: null, student: x.key }),
                      x.waiting,
                    ),
                  )}
                </div>
              );
            }
            return (
              <>
                {crumbs([
                  { label: 'All students', onClick: () => setDrill({ cls: null, student: null }) },
                  { label: st.label },
                ])}
                <div className="stack">{st.notes.map((it) => renderNote(it, { hideStudent: true }))}</div>
              </>
            );
          })()
        )}
      </div>
    </>
  );
}
