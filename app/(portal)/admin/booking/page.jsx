'use client';

import { useCallback, useEffect, useState } from 'react';
import AvailabilityCalendar from '@/components/AvailabilityCalendar';

// Middleware already turns non-admins away from /admin/*, and the portal shell
// provides the chrome — this page only has to worry about the booking data.
export default function AdminBookingPage() {
  const [tab, setTab] = useState('tutors');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Availability</h1>
          <p className="lede">
            Instructors and their weekly slots, session credits, upcoming bookings, and placement tests.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
        {[
          ['tutors', 'Instructors'],
          ['availability', 'Availability'],
          ['sessions', 'Add Sessions'],
          ['bookings', 'Bookings'],
          ['placements', 'Placement Tests'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'tutors' && <TutorsTab />}
      {tab === 'availability' && <AvailabilityTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'placements' && <PlacementTab />}
    </>
  );
}

/* ───────────────────────── Tutors ───────────────────────── */
function TutorsTab() {
  const [tutors, setTutors] = useState([]);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/tutors').then((r) => r.json()).then((d) => setTutors(d.tutors || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/admin/tutors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, specialty }),
    });
    const d = await res.json();
    if (!res.ok) setMsg(d.error || 'Failed.');
    else { setName(''); setSpecialty(''); load(); }
  }

  async function toggle(t) {
    await fetch(`/api/admin/tutors/${t._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !t.active }),
    });
    load();
  }

  async function remove(t) {
    if (!confirm(`Delete ${t.name} and their availability?`)) return;
    await fetch(`/api/admin/tutors/${t._id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Instructors</h2>
      </div>
      <form onSubmit={add} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
        <input className="input" style={{ width: 'auto', flex: '1 1 180px' }} placeholder="Instructor name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" style={{ width: 'auto', flex: '1 1 180px' }} placeholder="Specialty (optional)" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
        <button className="btn btn-primary">Add instructor</button>
      </form>
      {msg && <div className="notice err">{msg}</div>}
      {tutors.map((t) => (
        <TutorRow key={t._id} tutor={t} onChanged={load} onToggle={() => toggle(t)} onRemove={() => remove(t)} />
      ))}
      {tutors.length === 0 && <Empty>No instructors yet. Add one above.</Empty>}
    </div>
  );
}

function TutorRow({ tutor, onChanged, onToggle, onRemove }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(tutor.name);
  const [editSpecialty, setEditSpecialty] = useState(tutor.specialty || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const linked = !!tutor.userId;

  async function saveEdit(e) {
    e.preventDefault();
    await fetch(`/api/admin/tutors/${tutor._id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, specialty: editSpecialty }),
    });
    setEditing(false);
    onChanged();
  }

  async function link(e) {
    e.preventDefault();
    setMsg('');
    const res = await fetch(`/api/admin/tutors/${tutor._id}/account`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: password || undefined }),
    });
    const d = await res.json();
    if (!res.ok) setMsg(d.error || 'Failed.');
    else { setMsg(d.created ? 'Login created.' : 'Existing user promoted to instructor.'); setEmail(''); setPassword(''); onChanged(); }
  }
  async function unlink() {
    if (!confirm('Unlink this login and demote them to a family account?')) return;
    await fetch(`/api/admin/tutors/${tutor._id}/account`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <div className="row">
      <div className="main">
        <span className="strong">{tutor.name}</span>
        {tutor.specialty ? <span className="muted"> · {tutor.specialty}</span> : null}
        {!tutor.active && <span className="pill warn" style={{ marginLeft: 8 }}>hidden</span>}
        <span className={`pill ${linked ? 'ok' : 'mute'}`} style={{ marginLeft: 8 }}>
          {linked ? 'has login' : 'no login'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing((v) => !v)}>Edit</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>Login</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onToggle}>{tutor.active ? 'Hide' : 'Show'}</button>
        <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} onClick={onRemove}>Delete</button>
      </div>
      {editing && (
        <form onSubmit={saveEdit} style={{ flexBasis: '100%', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ width: 'auto', flex: '1 1 160px' }} placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <input className="input" style={{ width: 'auto', flex: '1 1 240px' }} placeholder="Specialty / label (e.g. Korean Language Learning)" value={editSpecialty} onChange={(e) => setEditSpecialty(e.target.value)} />
          <button className="btn btn-primary btn-sm">Save</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditName(tutor.name); setEditSpecialty(tutor.specialty || ''); setEditing(false); }}>Cancel</button>
          <span className="muted small" style={{ flexBasis: '100%' }}>Leave specialty blank to remove the label entirely.</span>
        </form>
      )}
      {open && (
        <form onSubmit={link} style={{ flexBasis: '100%', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ width: 'auto', flex: '1 1 180px' }} type="email" placeholder="instructor email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" style={{ width: 'auto', flex: '1 1 180px' }} type="password" placeholder="password (only if new account)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn btn-primary btn-sm">{linked ? 'Re-link' : 'Give login'}</button>
          {linked && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} onClick={unlink}>Unlink</button>}
          <span className="muted small" style={{ flexBasis: '100%' }}>
            If the email already has an account, they&apos;re promoted to tutor (password ignored). Otherwise a new tutor login is created with the password.
          </span>
          {msg && <span className="small" style={{ flexBasis: '100%', color: msg.includes('Failed') ? 'var(--err)' : 'var(--ok)' }}>{msg}</span>}
        </form>
      )}
    </div>
  );
}

/* ─────────────────────── Availability ─────────────────────── */
function AvailabilityTab() {
  const [tutors, setTutors] = useState([]);
  const [tutorId, setTutorId] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [exceptions, setExceptions] = useState([]);

  useEffect(() => {
    fetch('/api/admin/tutors').then((r) => r.json()).then((d) => {
      setTutors(d.tutors || []);
      if (d.tutors?.length) setTutorId(d.tutors[0]._id);
    });
  }, []);

  const load = useCallback(() => {
    if (!tutorId) return;
    fetch(`/api/admin/schedules?tutorId=${tutorId}`).then((r) => r.json()).then((d) => {
      setSchedules(d.schedules || []);
      setExceptions(d.exceptions || []);
    });
  }, [tutorId]);
  useEffect(() => { load(); }, [load]);

  async function addSlot(p) {
    await fetch('/api/admin/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorId, ...p }),
    });
    load();
  }
  async function cancelInstance(scheduleId, dateKey) {
    await fetch(`/api/admin/schedules/${scheduleId}/cancel-instance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dateKey }),
    });
    load();
  }
  async function deleteSeries(scheduleId) {
    await fetch(`/api/admin/schedules/${scheduleId}`, { method: 'DELETE' });
    load();
  }
  async function stopSeries(scheduleId) {
    await fetch(`/api/admin/schedules/${scheduleId}/stop`, { method: 'POST' });
    load();
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Weekly availability</h2>
      </div>
      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="avail-tutor">Instructor</label>
        <select id="avail-tutor" value={tutorId} onChange={(e) => setTutorId(e.target.value)}>
          {tutors.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
      </div>
      {tutorId ? (
        <AvailabilityCalendar
          schedules={schedules}
          exceptions={exceptions}
          onAddSlot={addSlot}
          onCancelInstance={cancelInstance}
          onDeleteSeries={deleteSeries}
          onStopSeries={stopSeries}
        />
      ) : <Empty>Add an instructor first.</Empty>}
    </div>
  );
}

/* ─────────────────────── Add Sessions ─────────────────────── */
function SessionsTab() {
  const [families, setFamilies] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [userId, setUserId] = useState('');
  const [tutorId, setTutorId] = useState('');
  const [sessions, setSessions] = useState('1');
  const [note, setNote] = useState('');
  const [grants, setGrants] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/families').then((r) => r.json()).then((d) => setFamilies(d.families || []));
    fetch('/api/admin/tutors').then((r) => r.json()).then((d) => setTutors(d.tutors || []));
    fetch('/api/admin/credits').then((r) => r.json()).then((d) => setGrants(d.credits || []));
  }, []);

  function famName(f) {
    const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
    const kids = (f.students || []).map((s) => s.name).filter(Boolean).join(', ');
    return kids ? `${base} (${kids})` : base;
  }

  async function grant(e) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/admin/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tutorId: tutorId || null, sessions: Number(sessions), note }),
    });
    const d = await res.json();
    if (!res.ok) setMsg(d.error || 'Failed.');
    else {
      setMsg('Sessions added.');
      setNote('');
      fetch('/api/admin/credits').then((r) => r.json()).then((dd) => setGrants(dd.credits || []));
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Add sessions</h2>
        </div>
        <form onSubmit={grant} style={{ maxWidth: 460 }}>
          <div className="field">
            <label htmlFor="grant-family">Family</label>
            <select id="grant-family" value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">Select a family…</option>
              {families.map((f) => <option key={f._id} value={f._id}>{famName(f)} ({f.email})</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="grant-sessions">Sessions to add</label>
            <input id="grant-sessions" type="number" min="1" value={sessions} onChange={(e) => setSessions(e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="grant-tutor">Instructor (optional; leave blank for any instructor)</label>
            <select id="grant-tutor" value={tutorId} onChange={(e) => setTutorId(e.target.value)}>
              <option value="">Any instructor</option>
              {tutors.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="grant-note">Note (e.g. &quot;Paid $200 via Zelle&quot;)</label>
            <input id="grant-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <button className="btn btn-primary" disabled={!userId}>Add sessions</button>
          {msg && (
            <div className={`notice ${msg === 'Sessions added.' ? 'ok' : 'err'}`} style={{ marginTop: '0.9rem', marginBottom: 0 }}>
              {msg}
            </div>
          )}
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent grants</h2>
        </div>
        {grants.map((g) => (
          <div className="row" key={g._id}>
            <div className="main small">
              <span className="strong">{g.userId ? famName(g.userId) : 'Family'}</span>
              {' · '}{g.remainingSessions}/{g.totalSessions} left
              {g.tutorId ? ` · ${g.tutorId.name}` : ' · any instructor'}
              {g.note ? <span className="muted"> · {g.note}</span> : null}
            </div>
          </div>
        ))}
        {grants.length === 0 && <Empty>No session grants yet.</Empty>}
      </div>
    </>
  );
}

/* ─────────────────────── Bookings ─────────────────────── */
function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const load = useCallback(() => {
    fetch('/api/admin/bookings?upcoming=1').then((r) => r.json()).then((d) => setBookings(d.bookings || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function cancelBooking(b) {
    const label = b.kind === 'diagnostic' ? (b.subject || 'Placement Test') : 'session';
    if (!confirm(`Cancel this ${label} for ${b.studentName}? The time reopens on the schedule, and the family will get a cancellation email automatically.`)) return;
    const res = await fetch(`/api/admin/bookings/${b._id}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) alert(d.error || 'Failed to cancel.');
    else if (!d.emailed) alert('Cancelled, but the email could not be sent. Please contact the family directly.');
    load();
  }
  function famName(u) {
    if (!u) return 'Family';
    const base = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email;
    const kids = (u.students || []).map((s) => s.name).filter(Boolean).join(', ');
    return kids ? `${base} (${kids})` : base;
  }
  // Placement tests live in their own tab; this list is regular sessions only.
  const sessions = bookings.filter((b) => b.kind !== 'diagnostic');
  return (
    <div className="card">
      <div className="card-head">
        <h2>Upcoming bookings</h2>
      </div>
      {sessions.map((b) => (
        <div className="row" key={b._id}>
          <div className="main small">
            <span className="strong">{new Date(b.startAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            {' · '}{b.studentName} · {b.tutorId?.name || 'Instructor'}
            {' · '}<span className="muted">{famName(b.userId)}</span>
            {b.status !== 'scheduled' ? <span className="pill warn" style={{ marginLeft: 8 }}>{b.status}</span> : null}
          </div>
          {b.status === 'scheduled' ? (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} onClick={() => cancelBooking(b)}>Cancel</button>
          ) : null}
        </div>
      ))}
      {sessions.length === 0 && <Empty>No upcoming bookings.</Empty>}
    </div>
  );
}

/* ───────────────────────── UI bits ───────────────────────── */
function Empty({ children }) {
  return (
    <div className="empty">
      <p>{children}</p>
    </div>
  );
}

/* ─────────────────────── Placement Tests ───────────────────────
   Upcoming placement-test (diagnostic) bookings, with the family's contact
   details parsed out of the booking notes, and a Cancel that reopens the slot. */
function PlacementTab() {
  const [bookings, setBookings] = useState(null);
  const load = useCallback(() => {
    fetch('/api/admin/bookings?upcoming=1')
      .then((r) => r.json())
      .then((d) => setBookings((d.bookings || []).filter((b) => b.kind === 'diagnostic')));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function cancelBooking(b) {
    if (!confirm(`Cancel ${b.studentName}'s ${b.subject || 'Placement Test'}? The time reopens on the public schedule, and the family will get a cancellation email automatically.`)) return;
    const res = await fetch(`/api/admin/bookings/${b._id}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) alert(d.error || 'Failed to cancel.');
    else if (!d.emailed) alert('Cancelled, but the email could not be sent. Please contact the family directly.');
    load();
  }

  // "Grade: 4 · Track: Literacy · Parent: … · Email: … · Phone: …" → {Grade, Parent, …}
  function parseNotes(notes) {
    const out = {};
    for (const part of (notes || '').split(' · ')) {
      const i = part.indexOf(': ');
      if (i > 0) out[part.slice(0, i)] = part.slice(i + 2);
    }
    return out;
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          Upcoming placement tests{bookings ? ` (${bookings.filter((b) => b.status === 'scheduled').length})` : ''}
        </h2>
      </div>
      {bookings === null ? (
        <p className="muted small">Loading…</p>
      ) : (
        <>
          {bookings.map((b) => {
            const n = parseNotes(b.notes);
            return (
              <div className="row" key={b._id}>
                <div className="main small">
                  <span className="strong">{new Date(b.startAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  {' · '}<span className="strong">{b.studentName}</span>
                  {n.Grade ? <span className="muted"> · Grade {n.Grade}</span> : null}
                  {' · '}{b.tutorId?.name || 'Instructor'}
                  {b.status !== 'scheduled' ? <span className="pill warn" style={{ marginLeft: 8 }}>{b.status}</span> : null}
                  <div className="muted small" style={{ marginTop: 3 }}>
                    {[n.Parent && `Parent: ${n.Parent}`, n.Email, n.Phone, n.Track && `Track: ${n.Track}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {b.status === 'scheduled' ? (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} onClick={() => cancelBooking(b)}>Cancel</button>
                ) : null}
              </div>
            );
          })}
          {bookings.length === 0 && <Empty>No upcoming placement tests.</Empty>}
        </>
      )}
    </div>
  );
}
