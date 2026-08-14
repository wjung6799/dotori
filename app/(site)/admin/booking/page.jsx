'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import AvailabilityCalendar from '@/components/AvailabilityCalendar';

const BROWN = '#6b5b47';
const ACCENT = '#e8a87c';

export default function AdminBookingPage() {
  const { status } = useSession();
  const [tab, setTab] = useState('tutors');

  if (status === 'loading') return <Pad>Loading…</Pad>;
  if (status !== 'authenticated')
    return (
      <Pad>
        Please <Link href="/login" style={{ color: ACCENT }}>log in</Link> as an admin.
      </Pad>
    );

  return (
    <section style={{ maxWidth: 1000, margin: '40px auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ color: BROWN, margin: 0 }}>Booking Admin</h1>
        <Link href="/admin" style={{ color: ACCENT, fontWeight: 600 }}>← Main admin</Link>
      </div>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #eee', marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['tutors', 'Instructors'],
          ['availability', 'Availability'],
          ['sessions', 'Add Sessions'],
          ['bookings', 'Bookings'],
          ['placements', 'Placement Tests'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: `3px solid ${tab === k ? ACCENT : 'transparent'}`,
              background: 'none',
              color: tab === k ? BROWN : '#9b8b77',
              fontWeight: 600,
              cursor: 'pointer',
            }}
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
    </section>
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
    <Card>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <input placeholder="Instructor name" value={name} onChange={(e) => setName(e.target.value)} style={inp()} required />
        <input placeholder="Specialty (optional)" value={specialty} onChange={(e) => setSpecialty(e.target.value)} style={inp()} />
        <button style={btn()}>Add instructor</button>
      </form>
      {msg && <p style={{ color: '#a3261a' }}>{msg}</p>}
      {tutors.map((t) => (
        <TutorRow key={t._id} tutor={t} onChanged={load} onToggle={() => toggle(t)} onRemove={() => remove(t)} />
      ))}
      {tutors.length === 0 && <Empty>No instructors yet. Add one above.</Empty>}
    </Card>
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
    <div style={{ borderBottom: '1px solid #f0ede8', padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <strong style={{ color: BROWN }}>{tutor.name}</strong>
          {tutor.specialty ? <span style={{ color: '#9b8b77' }}> · {tutor.specialty}</span> : null}
          {!tutor.active && <span style={{ color: '#b5654a' }}> (hidden)</span>}
          <span style={{ marginLeft: 8, fontSize: '0.78rem', color: linked ? '#1e6b2e' : '#b08a5a' }}>
            {linked ? '● has login' : '○ no login'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditing((v) => !v)} style={ghost()}>Edit</button>
          <button onClick={() => setOpen((v) => !v)} style={ghost()}>Login</button>
          <button onClick={onToggle} style={ghost()}>{tutor.active ? 'Hide' : 'Show'}</button>
          <button onClick={onRemove} style={danger()}>Delete</button>
        </div>
      </div>
      {editing && (
        <form onSubmit={saveEdit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, background: '#faf8f5', padding: 10, borderRadius: 10 }}>
          <input placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} style={inp()} required />
          <input placeholder="Specialty / label (e.g. Korean Language Learning)" value={editSpecialty} onChange={(e) => setEditSpecialty(e.target.value)} style={{ ...inp(), minWidth: 240 }} />
          <button style={btn()}>Save</button>
          <button type="button" onClick={() => { setEditName(tutor.name); setEditSpecialty(tutor.specialty || ''); setEditing(false); }} style={ghost()}>Cancel</button>
          <span style={{ fontSize: '0.78rem', color: '#9b8b77', flexBasis: '100%' }}>Leave specialty blank to remove the label entirely.</span>
        </form>
      )}
      {open && (
        <form onSubmit={link} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, background: '#faf8f5', padding: 10, borderRadius: 10 }}>
          <input type="email" placeholder="instructor email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp()} required />
          <input type="password" placeholder="password (only if new account)" value={password} onChange={(e) => setPassword(e.target.value)} style={inp()} />
          <button style={btn()}>{linked ? 'Re-link' : 'Give login'}</button>
          {linked && <button type="button" onClick={unlink} style={danger()}>Unlink</button>}
          <span style={{ fontSize: '0.78rem', color: '#9b8b77', flexBasis: '100%' }}>
            If the email already has an account, they&apos;re promoted to tutor (password ignored). Otherwise a new tutor login is created with the password.
          </span>
          {msg && <span style={{ color: msg.includes('Failed') ? '#a3261a' : '#1e6b2e', flexBasis: '100%' }}>{msg}</span>}
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

  return (
    <Card>
      <label style={{ color: BROWN, fontWeight: 600 }}>Instructor:&nbsp;</label>
      <select value={tutorId} onChange={(e) => setTutorId(e.target.value)} style={{ ...inp(), marginBottom: 16 }}>
        {tutors.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
      </select>
      {tutorId ? (
        <AvailabilityCalendar
          schedules={schedules}
          exceptions={exceptions}
          onAddSlot={addSlot}
          onCancelInstance={cancelInstance}
          onDeleteSeries={deleteSeries}
        />
      ) : <Empty>Add an instructor first.</Empty>}
    </Card>
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
    <Card>
      <form onSubmit={grant} style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
        <label style={lbl()}>Family</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} style={inp()} required>
          <option value="">Select a family…</option>
          {families.map((f) => <option key={f._id} value={f._id}>{famName(f)} ({f.email})</option>)}
        </select>

        <label style={lbl()}>Sessions to add</label>
        <input type="number" min="1" value={sessions} onChange={(e) => setSessions(e.target.value)} style={inp()} required />

        <label style={lbl()}>Instructor (optional; leave blank for any instructor)</label>
        <select value={tutorId} onChange={(e) => setTutorId(e.target.value)} style={inp()}>
          <option value="">Any instructor</option>
          {tutors.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>

        <label style={lbl()}>Note (e.g. &quot;Paid $200 via Zelle&quot;)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} style={inp()} />

        <button style={btn()} disabled={!userId}>Add sessions</button>
        {msg && <span style={{ color: msg === 'Sessions added.' ? '#1e6b2e' : '#a3261a' }}>{msg}</span>}
      </form>

      <h3 style={{ color: BROWN, marginTop: 24 }}>Recent grants</h3>
      {grants.map((g) => (
        <Row key={g._id}>
          <div style={{ color: BROWN, fontSize: '0.9rem' }}>
            <strong>{g.userId ? (famName(g.userId)) : 'Family'}</strong> · {g.remainingSessions}/{g.totalSessions} left
            {g.tutorId ? ` · ${g.tutorId.name}` : ' · any instructor'}
            {g.note ? <span style={{ color: '#9b8b77' }}> · {g.note}</span> : null}
          </div>
        </Row>
      ))}
      {grants.length === 0 && <Empty>No session grants yet.</Empty>}
    </Card>
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
    if (!confirm(`Cancel this ${label} for ${b.studentName}? The time reopens on the schedule. The family is not emailed automatically, so please contact them separately.`)) return;
    const res = await fetch(`/api/admin/bookings/${b._id}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) alert(d.error || 'Failed to cancel.');
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
    <Card>
      <h3 style={{ color: BROWN, marginTop: 0 }}>Upcoming bookings</h3>
      {sessions.map((b) => (
        <Row key={b._id}>
          <div style={{ color: BROWN, fontSize: '0.9rem' }}>
            <strong>{new Date(b.startAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
            {' · '}{b.studentName} · {b.tutorId?.name || 'Instructor'}
            {' · '}<span style={{ color: '#9b8b77' }}>{famName(b.userId)}</span>
            {b.status !== 'scheduled' ? <span style={{ color: '#b5654a' }}> · {b.status}</span> : null}
          </div>
          {b.status === 'scheduled' ? (
            <button onClick={() => cancelBooking(b)} style={danger()}>Cancel</button>
          ) : null}
        </Row>
      ))}
      {sessions.length === 0 && <Empty>No upcoming bookings.</Empty>}
    </Card>
  );
}

/* ───────────────────────── UI bits ───────────────────────── */
function Card({ children }) {
  return <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '1.5rem' }}>{children}</div>;
}
function Row({ children }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0ede8', gap: 12 }}>{children}</div>;
}
function Pad({ children }) {
  return <section style={{ maxWidth: 700, margin: '60px auto', padding: '0 1rem', color: BROWN, textAlign: 'center' }}>{children}</section>;
}
function Empty({ children }) {
  return <p style={{ color: '#9b8b77', margin: '8px 0 0' }}>{children}</p>;
}
const inp = () => ({ padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e6ddd2', fontSize: '0.95rem' });
const lbl = () => ({ color: BROWN, fontWeight: 600, fontSize: '0.88rem' });
const btn = () => ({ padding: '9px 18px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, cursor: 'pointer' });
const ghost = () => ({ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e6ddd2', background: '#fff', color: BROWN, cursor: 'pointer', fontSize: '0.85rem' });
const danger = () => ({ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e0b4a0', background: '#fff', color: '#b5654a', cursor: 'pointer', fontSize: '0.85rem' });

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
    if (!confirm(`Cancel ${b.studentName}'s ${b.subject || 'Placement Test'}? The time reopens on the public schedule. The family is not emailed automatically, so please contact them separately.`)) return;
    const res = await fetch(`/api/admin/bookings/${b._id}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) alert(d.error || 'Failed to cancel.');
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
    <Card>
      <h3 style={{ color: BROWN, marginTop: 0 }}>
        Upcoming placement tests{bookings ? ` (${bookings.filter((b) => b.status === 'scheduled').length})` : ''}
      </h3>
      {bookings === null ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          {bookings.map((b) => {
            const n = parseNotes(b.notes);
            return (
              <Row key={b._id}>
                <div style={{ color: BROWN, fontSize: '0.9rem' }}>
                  <strong>{new Date(b.startAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
                  {' · '}<strong>{b.studentName}</strong>
                  {n.Grade ? <span style={{ color: '#9b8b77' }}> · Grade {n.Grade}</span> : null}
                  {' · '}{b.tutorId?.name || 'Instructor'}
                  {b.status !== 'scheduled' ? <span style={{ color: '#b5654a' }}> · {b.status}</span> : null}
                  <div style={{ color: '#9b8b77', fontSize: '0.82rem', marginTop: 3 }}>
                    {[n.Parent && `Parent: ${n.Parent}`, n.Email, n.Phone, n.Track && `Track: ${n.Track}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {b.status === 'scheduled' ? (
                  <button onClick={() => cancelBooking(b)} style={danger()}>Cancel</button>
                ) : null}
              </Row>
            );
          })}
          {bookings.length === 0 && <Empty>No upcoming placement tests.</Empty>}
        </>
      )}
    </Card>
  );
}
