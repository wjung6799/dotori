'use client';

import { useCallback, useEffect, useState } from 'react';

import LocalTime from '../../LocalTime';

// Family display name, always with the student name(s) attached: "Parent (Student)".
// Feedback is written about a child but addressed to the account holder, so the
// instructor needs to see both to pick the right row out of a long list.
const famName = (f) => {
  if (!f) return 'Family';
  const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
  const kids = (f.students || []).map((s) => s.name).filter(Boolean).join(', ');
  return kids ? `${base} (${kids})` : base;
};

// The API hands back Date-ish JSON; LocalTime needs a real ISO string and would
// render "Invalid Date" for anything else, so unparseable values become null.
function iso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
  const [families, setFamilies] = useState([]);
  const [items, setItems] = useState(null); // null = still loading
  const [loadError, setLoadError] = useState('');
  const [userId, setUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tutor/feedback', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res, 'Could not load your feedback.'));
      const d = await res.json();
      setItems(d.feedback || []);
      setLoadError('');
    } catch (err) {
      setItems([]);
      setLoadError(err.message || 'Could not load your feedback.');
    }
  }, []);

  useEffect(() => {
    // The family list is what the picker is built from; a failure here is
    // reported through the same notice, since without it nothing can be sent.
    fetch('/api/tutor/families', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, 'Could not load the family list.'));
        return res.json();
      })
      .then((d) => setFamilies(d.families || []))
      .catch((err) => setLoadError((prev) => prev || err.message));
    load();
  }, [load]);

  async function submit(e) {
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
        setMsg({ ok: true, text: 'Feedback sent.' });
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

  // Feedback rows carry only the family's id, so the name comes from the picker
  // list. A family missing from it falls back to "Family" rather than an id.
  const famById = (id) => families.find((f) => String(f._id) === String(id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Feedback</h1>
          <p className="lede">
            Write a note home about a lesson. Families read it on their Reports &amp; feedback page.
          </p>
        </div>
      </div>

      {loadError ? <div className="notice warn">{loadError}</div> : null}

      <div className="card">
        <div className="card-head">
          <h2>Write feedback</h2>
        </div>

        <form onSubmit={submit} style={{ maxWidth: 560 }}>
          <div className="field">
            <label htmlFor="fb-family">Family</label>
            <select
              id="fb-family"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            >
              <option value="">
                {families.length ? 'Select a family…' : 'No families to write to yet'}
              </option>
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
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Feedback you&rsquo;ve sent</h2>
          {items && items.length > 0 ? (
            <span className="muted small nowrap">
              {items.length} {items.length === 1 ? 'note' : 'notes'}
            </span>
          ) : null}
        </div>

        {items === null ? (
          // A stable skeleton, so the card does not pop into existence on load.
          <p className="muted small mb0">Loading feedback…</p>
        ) : items.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">💬</span>
            <p>No feedback yet. Notes you send appear here.</p>
          </div>
        ) : (
          <div className="stack">
            {items.map((it) => {
              const written = iso(it.createdAt);
              return (
                <div className="row" key={it._id}>
                  {/* Full width: the note itself is the content, not a trailing
                      detail, so it reads as a block instead of a right column. */}
                  <div className="main" style={{ flex: '1 1 100%' }}>
                    <div className="meta">
                      <span className="strong">{famName(famById(it.userId))}</span>
                      {it.studentName ? ` · ${it.studentName}` : ''}
                      {written ? (
                        <>
                          {' · '}
                          <LocalTime iso={written} format="date" />
                        </>
                      ) : null}
                    </div>
                    <p className="mb0" style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>
                      {it.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
