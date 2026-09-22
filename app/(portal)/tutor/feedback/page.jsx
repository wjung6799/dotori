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
  // Inline editing of a sent note: which row is open, its draft, and a per-row
  // busy flag so Save/Delete on one note doesn't lock the others.
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ text: '', studentName: '' });
  const [rowBusy, setRowBusy] = useState(null);
  const [rowMsg, setRowMsg] = useState(null); // { id, text }

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
        body: JSON.stringify({ text: draft.text, studentName: draft.studentName }),
      });
      const d = await res.json();
      if (!res.ok) {
        setRowMsg({ id, text: d.error || 'Could not save the change.' });
        return;
      }
      setItems((prev) => prev.map((it) => (it._id === id ? d.feedback : it)));
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
      const res = await fetch(`/api/tutor/feedback/${it._id}`, { method: 'DELETE' });
      if (!res.ok) {
        setRowMsg({ id: it._id, text: await readError(res, 'Could not delete the note.') });
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
              const edited = iso(it.updatedAt);
              const isEditing = editingId === it._id;
              const thisBusy = rowBusy === it._id;
              return (
                <div className="row" key={it._id}>
                  {/* Full width: the note itself is the content, not a trailing
                      detail, so it reads as a block instead of a right column. */}
                  <div className="main" style={{ flex: '1 1 100%' }}>
                    <div className="meta">
                      <span className="strong">{famName(famById(it.userId))}</span>
                      {!isEditing && it.studentName ? ` · ${it.studentName}` : ''}
                      {written ? (
                        <>
                          {' · '}
                          <LocalTime iso={written} format="date" />
                        </>
                      ) : null}
                      {edited ? (
                        <>
                          {' · edited '}
                          <LocalTime iso={edited} format="date" />
                        </>
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
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(it)} disabled={thisBusy}>
                              Edit
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(it)} disabled={thisBusy}>
                              {thisBusy ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}

                    {rowMsg && rowMsg.id === it._id ? (
                      <div className="notice err" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                        {rowMsg.text}
                      </div>
                    ) : null}
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
