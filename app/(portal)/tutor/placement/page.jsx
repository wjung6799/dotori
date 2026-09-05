'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import LocalTime from '../../LocalTime';
import { formatUsd } from '@/lib/pricing';

// Same family label as everywhere else in the console: "Parent (Student, Student)".
const famName = (f) => {
  if (!f) return 'Family';
  const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
  const kids = (f.students || []).map((s) => s.name).filter(Boolean).join(', ');
  return kids ? `${base} (${kids})` : base;
};

const seatsLeft = (c) => (c.capacity ?? 0) - (c.enrolledCount ?? 0);
const isFull = (c) => seatsLeft(c) <= 0;

const seatText = (c) => {
  const left = seatsLeft(c);
  if (left <= 0) return 'full';
  return `${left} of ${c.capacity} seat${left === 1 ? '' : 's'} left`;
};

// Class tuition is stored in dollars, but every figure the portal prints goes
// through formatUsd, which speaks cents.
const tuitionCents = (c) => Math.round(Number(c?.price || 0) * 100);

// Status is the instructor's whole answer to "what happened to that one?", so it
// carries the wording as well as the tone.
const STATUS = {
  pending: { cls: 'pill warn', text: 'Waiting on the office' },
  approved: { cls: 'pill ok', text: 'Approved' },
  declined: { cls: 'pill err', text: 'Declined' },
};

export default function TutorPlacementPage() {
  const [families, setFamilies] = useState([]);
  const [classes, setClasses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // A tutor login that is not linked to an instructor profile gets a 403 with a
  // plain message. It is not an error the instructor can fix by retrying, so it
  // sits at the top of the page instead of blowing the form away.
  const [linkWarning, setLinkWarning] = useState('');

  const [userId, setUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text }
  const [busy, setBusy] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/tutor/enrollment-requests');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) setLinkWarning(data.error || 'Your login is not linked to an instructor profile yet.');
        setRequests([]);
        return;
      }
      setRequests(data.requests || []);
    } catch {
      // A failed reload leaves the last good list on screen; the form still works.
    }
  }, []);

  useEffect(() => {
    let alive = true;

    Promise.all([
      fetch('/api/tutor/families').then((r) => r.json()).catch(() => ({})),
      fetch('/api/classes').then((r) => r.json()).catch(() => ({})),
    ]).then(([f, c]) => {
      if (!alive) return;
      setFamilies(f.families || []);
      // The office only places students into classes that are still running.
      setClasses((c.classes || []).filter((k) => k.active !== false));
      setLoading(false);
    });

    loadRequests();
    return () => {
      alive = false;
    };
  }, [loadRequests]);

  const family = useMemo(
    () => families.find((f) => String(f._id) === String(userId)),
    [families, userId],
  );
  const students = family?.students || [];
  const noStudents = Boolean(family) && students.length === 0;

  const chosenClass = useMemo(
    () => classes.find((c) => String(c._id) === String(classId)),
    [classes, classId],
  );

  function pickFamily(next) {
    setUserId(next);
    setStudentName(''); // the old student belongs to the old family
    setMsg(null);
  }

  function reset() {
    setUserId('');
    setStudentName('');
    setClassId('');
    setNote('');
  }

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (!userId || !studentName || !classId) {
      setMsg({ type: 'err', text: 'Pick a family, a student and a class.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/tutor/enrollment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, studentName, classId, note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setMsg({
          type: 'ok',
          text: 'Request sent. The office will review it, and approving it raises the invoice for the family — you never charge anyone yourself.',
        });
        reset();
        loadRequests();
      } else if (res.status === 403) {
        // Not a mistake on this form — the login itself is not linked yet.
        setLinkWarning(data.error || 'Your login is not linked to an instructor profile yet.');
      } else {
        // 409 covers already enrolled / already requested / class full; each one
        // comes back with a plain sentence worth showing verbatim.
        setMsg({ type: 'err', text: data.error || 'Could not send that request.' });
      }
    } catch {
      setMsg({ type: 'err', text: 'Could not reach the server. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = Boolean(userId && studentName && classId) && !noStudents && !busy;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Class placement</h1>
          <p className="lede">
            You know who is ready to move up. Propose a class here and the office decides —
            approval is what enrols the student and bills the family. Nothing on this page charges
            anyone.
          </p>
        </div>
      </div>

      {linkWarning ? <div className="notice warn">{linkWarning}</div> : null}

      <div className="card">
        <div className="card-head">
          <h2>Propose a placement</h2>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="pl-family">Family</label>
            <select
              id="pl-family"
              value={userId}
              onChange={(e) => pickFamily(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">
                {loading
                  ? 'Loading families…'
                  : families.length
                    ? 'Select a family…'
                    : 'No families on file yet'}
              </option>
              {families.map((f) => (
                <option key={f._id} value={f._id}>
                  {famName(f)} ({f.email})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="pl-student">Student</label>
            <select
              id="pl-student"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              disabled={!userId || noStudents}
              required
            >
              <option value="">
                {!userId
                  ? 'Pick a family first…'
                  : noStudents
                    ? 'No students on this family yet'
                    : 'Select a student…'}
              </option>
              {students.map((s, i) => (
                <option key={`${s.name}-${i}`} value={s.name}>
                  {s.name}
                  {s.grade ? ` · Grade ${s.grade}` : ''}
                </option>
              ))}
            </select>
            {noStudents ? (
              <div className="hint">
                This family has no students listed, so there is nobody to place. Ask the office to
                add the student to their account first.
              </div>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="pl-class">Class</label>
            <select
              id="pl-class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">
                {loading
                  ? 'Loading classes…'
                  : classes.length
                    ? 'Select a class…'
                    : 'No active classes right now'}
              </option>
              {/* A full class stays visible but unpickable: the instructor still
                  needs to see that the class exists and why it is out of reach. */}
              {classes.map((c) => (
                <option key={c._id} value={c._id} disabled={isFull(c)}>
                  {c.name}
                  {c.schedule ? ` · ${c.schedule}` : ''} · {seatText(c)}
                </option>
              ))}
            </select>
            {chosenClass ? (
              <div className="hint">
                {tuitionCents(chosenClass)
                  ? `Tuition ${formatUsd(tuitionCents(chosenClass))} — invoiced to the family by the office if this is approved.`
                  : 'No tuition is set on this class, so approving it would seat the student without an invoice.'}
              </div>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="pl-note">Why this student? (optional)</label>
            <textarea
              id="pl-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Finished the Level 2 reader and is bored in the current group."
              maxLength={500}
            />
            <div className="hint">The office reads this when deciding. 500 characters max.</div>
          </div>

          <button type="submit" className="btn btn-accent" disabled={!canSubmit}>
            {busy ? 'Sending…' : 'Send to the office'}
          </button>

          {msg ? (
            <div className={`notice ${msg.type}`} style={{ marginTop: '1rem', marginBottom: 0 }}>
              {msg.text}
            </div>
          ) : null}
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Placements you&rsquo;ve proposed</h2>
        </div>

        {loading && requests.length === 0 ? (
          <div className="empty">
            <span className="ico">⏳</span>
            <p>Loading your requests…</p>
          </div>
        ) : null}

        {!loading && requests.length === 0 ? (
          <div className="empty">
            <span className="ico">📝</span>
            <p>You haven&rsquo;t proposed any placements yet.</p>
          </div>
        ) : null}

        {requests.length > 0 ? (
          <div className="stack">
            {requests.map((r) => {
              const tone = STATUS[r.status] || { cls: 'pill mute', text: r.status || 'Unknown' };
              return (
                <div className="row" key={r.id}>
                  <div className="main">
                    <div className="strong">
                      {r.studentName} &rarr; {r.className}
                      {r.schedule ? <span className="muted"> · {r.schedule}</span> : null}
                    </div>
                    <div className="meta">
                      {r.familyName ? `${r.familyName} · ` : ''}sent{' '}
                      <LocalTime iso={r.createdAt} format="date" />
                      {r.decidedAt ? (
                        <>
                          {' · decided '}
                          <LocalTime iso={r.decidedAt} format="date" />
                        </>
                      ) : null}
                    </div>
                    {r.note ? (
                      <div className="small" style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>
                        {r.note}
                      </div>
                    ) : null}
                    {r.declineReason ? (
                      <div className="meta" style={{ marginTop: '0.35rem' }}>
                        Office said: {r.declineReason}
                      </div>
                    ) : null}
                  </div>
                  <span className={tone.cls}>{tone.text}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </>
  );
}
