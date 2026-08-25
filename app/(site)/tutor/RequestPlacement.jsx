'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// This panel lives on the marketing-side instructor page, which styles itself with
// inline styles rather than the portal stylesheet — so the palette and the little
// style helpers below mirror app/(site)/tutor/page.jsx on purpose.
const BROWN = '#6b5b47';
const ACCENT = '#e8a87c';
const MUTED = '#9b8b77';

// Same family label as the rest of the instructor console: "Parent (Student)".
const famName = (f) => {
  if (!f) return 'Family';
  const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
  const kids = (f.students || []).map((s) => s.name).filter(Boolean).join(', ');
  return kids ? `${base} (${kids})` : base;
};

const seatText = (c) => {
  const taken = c.enrolledCount ?? 0;
  const cap = c.capacity ?? 0;
  const left = cap - taken;
  if (left <= 0) return 'full';
  return `${left} of ${cap} seat${left === 1 ? '' : 's'} left`;
};

const isFull = (c) => (c.enrolledCount ?? 0) >= (c.capacity ?? 0);

const dateText = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export default function RequestPlacement() {
  const [families, setFamilies] = useState([]);
  const [classes, setClasses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);

  const loadRequests = useCallback(() => {
    fetch('/api/tutor/enrollment-requests')
      .then((r) => r.json())
      .then((d) => setRequests(d.requests || []))
      .catch(() => {});
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
    return () => { alive = false; };
  }, [loadRequests]);

  const family = useMemo(
    () => families.find((f) => String(f._id) === String(userId)),
    [families, userId],
  );
  const students = family?.students || [];
  const noStudents = Boolean(family) && students.length === 0;

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
      setMsg({ ok: false, text: 'Pick a family, a student and a class.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/tutor/enrollment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, studentName, classId, note: note.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setMsg({
          ok: true,
          text: 'Request sent. The office will review it, and approving it raises the invoice (청구서) for the family — you never charge anyone yourself.',
        });
        reset();
        loadRequests();
      } else {
        // 409 (already enrolled / already requested / class full) and 403 (login not
        // linked to an instructor profile) both come back with a plain message.
        setMsg({ ok: false, text: d.error || 'Could not send that request.' });
      }
    } catch {
      setMsg({ ok: false, text: 'Could not reach the server. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = Boolean(userId && studentName && classId) && !noStudents && !busy;

  return (
    <Card>
      <h3 style={{ color: BROWN, marginTop: 0, marginBottom: 4 }}>Propose a placement</h3>
      <p style={{ color: MUTED, fontSize: '0.85rem', margin: '0 0 18px', maxWidth: 520 }}>
        You know who is ready to move up. Suggest a class (반) here and the office decides —
        approval is what enrolls the student and raises the invoice. Nothing you do on this
        form charges a family.
      </p>

      <form onSubmit={submit} style={{ display: 'grid', gap: 10, maxWidth: 520, marginBottom: 28 }}>
        <label style={lbl()}>Family</label>
        <select value={userId} onChange={(e) => pickFamily(e.target.value)} style={inp()} disabled={loading} required>
          <option value="">{loading ? 'Loading families…' : 'Select a family…'}</option>
          {families.map((f) => (
            <option key={f._id} value={f._id}>{famName(f)} ({f.email})</option>
          ))}
        </select>

        <label style={lbl()}>Student</label>
        <select
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          style={inp()}
          disabled={!userId || noStudents}
          required
        >
          <option value="">
            {!userId ? 'Pick a family first…' : noStudents ? 'No students on this family yet' : 'Select a student…'}
          </option>
          {students.map((s, i) => (
            <option key={`${s.name}-${i}`} value={s.name}>
              {s.name}{s.grade ? ` · Grade ${s.grade}` : ''}
            </option>
          ))}
        </select>
        {noStudents && (
          <span style={{ color: '#a3261a', fontSize: '0.85rem' }}>
            This family has no students listed, so there is nobody to place. Ask the office to add
            the student to their account first.
          </span>
        )}

        <label style={lbl()}>Class</label>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} style={inp()} disabled={loading} required>
          <option value="">
            {loading ? 'Loading classes…' : classes.length ? 'Select a class…' : 'No active classes right now'}
          </option>
          {classes.map((c) => (
            <option key={c._id} value={c._id} disabled={isFull(c)}>
              {c.name}{c.schedule ? ` · ${c.schedule}` : ''} · {seatText(c)}
            </option>
          ))}
        </select>

        <label style={lbl()}>Why this student? (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ ...inp(), minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="e.g. Finished the Level 2 reader and is bored in the current group."
          maxLength={500}
        />

        <button style={btn()} disabled={!canSubmit}>
          {busy ? 'Sending…' : 'Send to the office'}
        </button>
        {msg && (
          <span style={{ color: msg.ok ? '#1e6b2e' : '#a3261a', fontSize: '0.9rem' }}>{msg.text}</span>
        )}
      </form>

      <h3 style={{ color: BROWN, marginTop: 0 }}>Placements you&apos;ve proposed</h3>
      {loading && requests.length === 0 && <Empty>Loading…</Empty>}
      {requests.map((r) => (
        <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0ede8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div style={{ color: BROWN, fontSize: '0.9rem' }}>
              <strong>{r.studentName}</strong>
              {' → '}{r.className}
              {r.schedule ? <span style={{ color: MUTED }}> · {r.schedule}</span> : null}
            </div>
            <Badge status={r.status} />
          </div>
          <div style={{ color: MUTED, fontSize: '0.82rem', marginTop: 2 }}>
            {r.familyName ? `${r.familyName} · ` : ''}sent {dateText(r.createdAt)}
            {r.decidedAt ? ` · decided ${dateText(r.decidedAt)}` : ''}
          </div>
          {r.note ? (
            <div style={{ color: '#5c5145', fontSize: '0.88rem', marginTop: 6, whiteSpace: 'pre-wrap' }}>
              {r.note}
            </div>
          ) : null}
          {r.declineReason ? (
            <div style={{ color: '#a3261a', fontSize: '0.85rem', marginTop: 6 }}>
              Office said: {r.declineReason}
            </div>
          ) : null}
        </div>
      ))}
      {!loading && requests.length === 0 && <Empty>You haven&apos;t proposed any placements yet.</Empty>}
    </Card>
  );
}

function Badge({ status }) {
  const tone = {
    pending: { bg: '#fdf3e7', fg: '#a9761f', text: 'Waiting on the office' },
    approved: { bg: '#eaf5ec', fg: '#1e6b2e', text: 'Approved' },
    declined: { bg: '#fbecea', fg: '#a3261a', text: 'Declined' },
  }[status] || { bg: '#f3efe9', fg: MUTED, text: status || 'Unknown' };
  return (
    <span
      style={{
        background: tone.bg, color: tone.fg, borderRadius: 999, padding: '3px 10px',
        fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
      }}
    >
      {tone.text}
    </span>
  );
}

function Card({ children }) {
  return <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '1.5rem' }}>{children}</div>;
}
function Empty({ children }) {
  return <p style={{ color: MUTED, margin: '8px 0 0' }}>{children}</p>;
}
const inp = () => ({ padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e6ddd2', fontSize: '0.95rem' });
const lbl = () => ({ color: BROWN, fontWeight: 600, fontSize: '0.88rem' });
const btn = () => ({ padding: '9px 18px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, cursor: 'pointer' });
