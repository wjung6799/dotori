'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import AvailabilityCalendar from '@/components/AvailabilityCalendar';

const BROWN = '#6b5b47';
const ACCENT = '#e8a87c';

const famName = (f) =>
  f ? [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email : 'Family';

export default function TutorDashboard() {
  const { status } = useSession();
  const [tab, setTab] = useState('availability');
  const [data, setData] = useState(null); // { tutor, schedules, exceptions }

  const loadMe = useCallback(() => {
    fetch('/api/tutor/me').then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(() => { if (status === 'authenticated') loadMe(); }, [status, loadMe]);

  if (status === 'loading') return <Pad>Loading…</Pad>;
  if (status !== 'authenticated')
    return <Pad>Please <Link href="/login" style={{ color: ACCENT }}>log in</Link>.</Pad>;
  if (data && data.tutor === null)
    return (
      <Pad>
        Your account isn&apos;t linked to a tutor profile yet. Ask an admin to link you on the
        Booking Admin → Tutors tab.
      </Pad>
    );

  // Availability handlers (scoped to the signed-in tutor).
  async function addSlot(p) {
    await fetch('/api/tutor/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    loadMe();
  }
  async function cancelInstance(scheduleId, dateKey) {
    await fetch(`/api/tutor/schedules/${scheduleId}/cancel-instance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dateKey }),
    });
    loadMe();
  }
  async function deleteSeries(scheduleId) {
    await fetch(`/api/tutor/schedules/${scheduleId}`, { method: 'DELETE' });
    loadMe();
  }

  return (
    <section style={{ maxWidth: 1000, margin: '40px auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ color: BROWN, margin: 0 }}>Tutor Dashboard</h1>
      </div>
      <p style={{ color: '#9b8b77', marginTop: 0 }}>
        {data?.tutor ? `Signed in as ${data.tutor.name}` : ''}
      </p>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #eee', marginBottom: 20, flexWrap: 'wrap' }}>
        {[['availability', 'My Availability'], ['sessions', 'Add Sessions'], ['bookings', 'My Bookings']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={tabBtn(tab === k)}>{l}</button>
        ))}
      </div>

      {tab === 'availability' && (
        <Card>
          {data ? (
            <AvailabilityCalendar
              schedules={data.schedules || []}
              exceptions={data.exceptions || []}
              onAddSlot={addSlot}
              onCancelInstance={cancelInstance}
              onDeleteSeries={deleteSeries}
            />
          ) : 'Loading…'}
        </Card>
      )}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'bookings' && <BookingsTab />}
    </section>
  );
}

function SessionsTab() {
  const [families, setFamilies] = useState([]);
  const [grants, setGrants] = useState([]);
  const [userId, setUserId] = useState('');
  const [sessions, setSessions] = useState('1');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');

  const loadGrants = useCallback(() => {
    fetch('/api/tutor/credits').then((r) => r.json()).then((d) => setGrants(d.credits || []));
  }, []);
  useEffect(() => {
    fetch('/api/tutor/families').then((r) => r.json()).then((d) => setFamilies(d.families || []));
    loadGrants();
  }, [loadGrants]);

  async function grant(e) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/tutor/credits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, sessions: Number(sessions), note }),
    });
    const d = await res.json();
    if (!res.ok) setMsg(d.error || 'Failed.');
    else { setMsg('Sessions added.'); setNote(''); loadGrants(); }
  }
  async function remove(id) {
    if (!confirm('Remove this session grant?')) return;
    await fetch(`/api/tutor/credits/${id}`, { method: 'DELETE' });
    loadGrants();
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
        <label style={lbl()}>Note (e.g. &quot;Paid via Zelle&quot;)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} style={inp()} />
        <button style={btn()} disabled={!userId}>Add sessions</button>
        {msg && <span style={{ color: msg === 'Sessions added.' ? '#1e6b2e' : '#a3261a' }}>{msg}</span>}
      </form>

      <h3 style={{ color: BROWN, marginTop: 24 }}>Sessions you&apos;ve granted</h3>
      {grants.map((g) => (
        <Row key={g._id}>
          <div style={{ color: BROWN, fontSize: '0.9rem' }}>
            <strong>{famName(g.userId)}</strong> · {g.remainingSessions}/{g.totalSessions} left
            {g.note ? <span style={{ color: '#9b8b77' }}> · {g.note}</span> : null}
          </div>
          <button onClick={() => remove(g._id)} style={danger()}>Remove</button>
        </Row>
      ))}
      {grants.length === 0 && <Empty>No grants yet.</Empty>}
    </Card>
  );
}

function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  useEffect(() => {
    fetch('/api/tutor/bookings').then((r) => r.json()).then((d) => setBookings(d.bookings || []));
  }, []);
  return (
    <Card>
      <h3 style={{ color: BROWN, marginTop: 0 }}>Your upcoming bookings</h3>
      {bookings.map((b) => (
        <Row key={b._id}>
          <div style={{ color: BROWN, fontSize: '0.9rem' }}>
            <strong>{new Date(b.startAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
            {' · '}{b.studentName}{' · '}<span style={{ color: '#9b8b77' }}>{famName(b.userId)}</span>
          </div>
        </Row>
      ))}
      {bookings.length === 0 && <Empty>No upcoming bookings.</Empty>}
    </Card>
  );
}

function Card({ children }) {
  return <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '1.5rem' }}>{children}</div>;
}
function Row({ children }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0ede8', gap: 12 }}>{children}</div>;
}
function Pad({ children }) {
  return <section style={{ maxWidth: 640, margin: '60px auto', padding: '0 1rem', color: BROWN, textAlign: 'center' }}>{children}</section>;
}
function Empty({ children }) {
  return <p style={{ color: '#9b8b77', margin: '8px 0 0' }}>{children}</p>;
}
const tabBtn = (on) => ({ padding: '10px 16px', border: 'none', borderBottom: `3px solid ${on ? ACCENT : 'transparent'}`, background: 'none', color: on ? BROWN : '#9b8b77', fontWeight: 600, cursor: 'pointer' });
const inp = () => ({ padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e6ddd2', fontSize: '0.95rem' });
const lbl = () => ({ color: BROWN, fontWeight: 600, fontSize: '0.88rem' });
const btn = () => ({ padding: '9px 18px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, cursor: 'pointer' });
const danger = () => ({ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e0b4a0', background: '#fff', color: '#b5654a', cursor: 'pointer', fontSize: '0.85rem' });
