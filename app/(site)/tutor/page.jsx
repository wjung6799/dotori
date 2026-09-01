'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import AvailabilityCalendar from '@/components/AvailabilityCalendar';

const BROWN = '#6b5b47';
const ACCENT = '#e8a87c';

// Family display name, always with the student name(s) attached: "Parent (Student)".
const famName = (f) => {
  if (!f) return 'Family';
  const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
  const kids = (f.students || []).map((s) => s.name).filter(Boolean).join(', ');
  return kids ? `${base} (${kids})` : base;
};

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
        Your account isn&apos;t linked to an instructor profile yet. Ask an admin to link you on the
        Booking Admin → Instructors tab.
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
  async function stopSeries(scheduleId) {
    await fetch(`/api/tutor/schedules/${scheduleId}/stop`, { method: 'POST' });
    loadMe();
  }

  return (
    <section style={{ maxWidth: 1000, margin: '40px auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ color: BROWN, margin: 0 }}>Instructor Dashboard</h1>
      </div>
      <p style={{ color: '#9b8b77', marginTop: 0 }}>
        {data?.tutor ? `Signed in as ${data.tutor.name}` : ''}
      </p>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #eee', marginBottom: 20, flexWrap: 'wrap' }}>
        {[['availability', 'My Availability'], ['sessions', 'Add Sessions'], ['bookings', 'My Bookings'], ['feedback', 'Feedback']].map(([k, l]) => (
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
              onStopSeries={stopSeries}
            />
          ) : 'Loading…'}
        </Card>
      )}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'bookings' && <BookingsTab tutorId={data?.tutor?._id} />}
      {tab === 'feedback' && <FeedbackTab />}
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

const whenText = (d) =>
  new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function BookingsTab({ tutorId }) {
  const [bookings, setBookings] = useState([]);
  const [pastBookings, setPastBookings] = useState([]);
  const [families, setFamilies] = useState([]);
  const [slots, setSlots] = useState([]);
  const [pastSlots, setPastSlots] = useState([]);
  const [mode, setMode] = useState('upcoming'); // 'upcoming' | 'past'
  const [userId, setUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [slotKey, setSlotKey] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const isPast = mode === 'past';
  const options = isPast ? pastSlots : slots;

  const loadBookings = useCallback(() => {
    fetch('/api/tutor/bookings').then((r) => r.json()).then((d) => setBookings(d.bookings || []));
    fetch('/api/tutor/bookings?past=1').then((r) => r.json()).then((d) => setPastBookings(d.bookings || []));
  }, []);
  const loadSlots = useCallback(() => {
    if (!tutorId) return;
    fetch(`/api/booking/slots?tutorId=${tutorId}&days=56`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
    fetch('/api/tutor/past-slots?days=60')
      .then((r) => r.json())
      .then((d) => setPastSlots(d.slots || []));
  }, [tutorId]);
  useEffect(() => {
    loadBookings();
    fetch('/api/tutor/families').then((r) => r.json()).then((d) => setFamilies(d.families || []));
  }, [loadBookings]);
  useEffect(() => { loadSlots(); }, [loadSlots]);

  function switchMode(next) {
    setMode(next);
    setSlotKey('');
    setRecurring(false);
    setMsg(null);
  }

  async function book(e) {
    e.preventDefault();
    setMsg(null);
    if (!userId || !studentName.trim() || !slotKey) {
      setMsg({ ok: false, text: 'Pick a family, enter a student, and choose a time.' });
      return;
    }
    const [scheduleId, dateKey] = slotKey.split('|');
    setBusy(true);
    try {
      const res = await fetch('/api/tutor/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          studentName: studentName.trim(),
          scheduleId,
          dateKey,
          recurring: isPast ? false : recurring,
          logPast: isPast,
        }),
      });
      const d = await res.json();
      if (!res.ok) setMsg({ ok: false, text: d.error || 'Failed to book.' });
      else {
        let text;
        if (d.logged) {
          text = d.creditConsumed
            ? 'Session recorded. One of the family’s sessions was used.'
            : 'Session recorded. The family had no sessions left, so no credit was deducted.';
        } else if (d.recurring) {
          text = `Weekly booking set: ${d.recurring.booked} upcoming session${d.recurring.booked === 1 ? '' : 's'} booked. It’ll keep booking each week (credits permitting).`;
        } else if (d.creditConsumed) {
          text = 'Session booked. One of the family’s sessions was used.';
        } else {
          text = 'Session booked. The family had no sessions left, so no credit was deducted.';
        }
        setMsg({ ok: true, text });
        setStudentName('');
        setSlotKey('');
        setRecurring(false);
        loadBookings();
        loadSlots();
      }
    } finally { setBusy(false); }
  }

  async function cancelBooking(id, logged) {
    const q = logged
      ? 'Remove this logged session? The family’s credit will be refunded.'
      : 'Cancel this session? The family’s credit will be refunded.';
    if (!confirm(q)) return;
    const res = await fetch(`/api/tutor/bookings/${id}`, { method: 'DELETE' });
    if (res.ok) { loadBookings(); loadSlots(); }
  }

  return (
    <Card>
      <h3 style={{ color: BROWN, marginTop: 0 }}>Book a student into a session</h3>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['upcoming', 'Upcoming session'], ['past', 'Session that already happened']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => switchMode(k)} style={pill(mode === k)}>{l}</button>
        ))}
      </div>
      {isPast && (
        <p style={{ color: '#9b8b77', fontSize: '0.85rem', margin: '0 0 14px', maxWidth: 460 }}>
          For a student who showed up without booking. The session is recorded as completed and a
          session is deducted; the family isn’t emailed.
        </p>
      )}
      <form onSubmit={book} style={{ display: 'grid', gap: 10, maxWidth: 460, marginBottom: 28 }}>
        <label style={lbl()}>Family</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} style={inp()} required>
          <option value="">Select a family…</option>
          {families.map((f) => <option key={f._id} value={f._id}>{famName(f)} ({f.email})</option>)}
        </select>
        <label style={lbl()}>Student name</label>
        <input value={studentName} onChange={(e) => setStudentName(e.target.value)} style={inp()} placeholder="Which student?" required />
        <label style={lbl()}>{isPast ? 'Which session did they attend?' : 'Time slot'}</label>
        <select value={slotKey} onChange={(e) => setSlotKey(e.target.value)} style={inp()} required>
          <option value="">
            {options.length
              ? 'Select a time…'
              : isPast
                ? 'No open seats in your last 8 weeks of sessions'
                : 'No open times in the next 8 weeks'}
          </option>
          {options.map((s) => (
            <option key={`${s.scheduleId}|${s.dateKey}`} value={`${s.scheduleId}|${s.dateKey}`}>
              {s.dateLabel} · {s.timeLabel}{s.subject ? ` · ${s.subject}` : ''}
            </option>
          ))}
        </select>
        {!isPast && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', color: BROWN, fontSize: '0.9rem' }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              <strong>Repeat weekly</strong>
              <span style={{ display: 'block', fontSize: '0.8rem', color: '#9b8b77' }}>
                Keeps this same weekly time booked from the family’s sessions. Needs a session balance to continue.
              </span>
            </span>
          </label>
        )}
        <button style={btn()} disabled={busy || !userId || !slotKey}>
          {busy ? (isPast ? 'Recording…' : 'Booking…') : isPast ? 'Record attendance' : recurring ? 'Book weekly' : 'Book session'}
        </button>
        {msg && <span style={{ color: msg.ok ? '#1e6b2e' : '#a3261a' }}>{msg.text}</span>}
      </form>

      <h3 style={{ color: BROWN, marginTop: 0 }}>Your upcoming bookings</h3>
      {bookings.map((b) => (
        <Row key={b._id}>
          <div style={{ color: BROWN, fontSize: '0.9rem' }}>
            <strong>{whenText(b.startAt)}</strong>
            {' · '}{b.studentName}{' · '}<span style={{ color: '#9b8b77' }}>{famName(b.userId)}</span>
            {b.recurringId && <span title="Part of a weekly booking" style={{ marginLeft: 8, fontSize: '0.72rem', color: ACCENT, fontWeight: 700 }}>↻ weekly</span>}
          </div>
          <button onClick={() => cancelBooking(b._id)} style={danger()}>Cancel</button>
        </Row>
      ))}
      {bookings.length === 0 && <Empty>No upcoming bookings.</Empty>}

      <h3 style={{ color: BROWN, marginTop: 24 }}>Past sessions</h3>
      {pastBookings.map((b) => (
        <Row key={b._id}>
          <div style={{ color: BROWN, fontSize: '0.9rem' }}>
            <strong>{whenText(b.startAt)}</strong>
            {' · '}{b.studentName}{' · '}<span style={{ color: '#9b8b77' }}>{famName(b.userId)}</span>
            {b.status === 'completed' && <span title="Attendance logged after the session" style={{ marginLeft: 8, fontSize: '0.72rem', color: ACCENT, fontWeight: 700 }}>✓ logged</span>}
          </div>
          {/* Only a logged session can be undone here; removing one that was booked
              normally would refund a credit for a session actually delivered. */}
          {b.status === 'completed' && (
            <button onClick={() => cancelBooking(b._id, true)} style={danger()}>Remove</button>
          )}
        </Row>
      ))}
      {pastBookings.length === 0 && <Empty>No past sessions on record.</Empty>}
    </Card>
  );
}

function FeedbackTab() {
  const [families, setFamilies] = useState([]);
  const [items, setItems] = useState([]);
  const [userId, setUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/tutor/feedback').then((r) => r.json()).then((d) => setItems(d.feedback || []));
  }, []);
  useEffect(() => {
    fetch('/api/tutor/families').then((r) => r.json()).then((d) => setFamilies(d.families || []));
    load();
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/tutor/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, studentName, text }),
    });
    const d = await res.json();
    if (!res.ok) setMsg(d.error || 'Failed.');
    else { setMsg('Feedback sent.'); setText(''); setStudentName(''); load(); }
  }

  const famById = (id) => families.find((f) => String(f._id) === String(id));

  return (
    <Card>
      <form onSubmit={submit} style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
        <label style={lbl()}>Family</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} style={inp()} required>
          <option value="">Select a family…</option>
          {families.map((f) => <option key={f._id} value={f._id}>{famName(f)} ({f.email})</option>)}
        </select>
        <label style={lbl()}>Student name (optional)</label>
        <input value={studentName} onChange={(e) => setStudentName(e.target.value)} style={inp()} placeholder="e.g. Mochi" />
        <label style={lbl()}>Feedback</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ ...inp(), minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Write feedback for the family…"
          required
        />
        <button style={btn()} disabled={!userId || !text.trim()}>Send feedback</button>
        {msg && <span style={{ color: msg === 'Feedback sent.' ? '#1e6b2e' : '#a3261a' }}>{msg}</span>}
      </form>

      <h3 style={{ color: BROWN, marginTop: 24 }}>Feedback you&apos;ve sent</h3>
      {items.map((it) => (
        <div key={it._id} style={{ padding: '12px 0', borderBottom: '1px solid #f0ede8' }}>
          <div style={{ color: BROWN, fontSize: '0.85rem', marginBottom: 4 }}>
            <strong>{famName(famById(it.userId))}</strong>
            {it.studentName ? ` · ${it.studentName}` : ''}
            <span style={{ color: '#9b8b77' }}> · {new Date(it.createdAt).toLocaleDateString()}</span>
          </div>
          <div style={{ color: '#5c5145', fontSize: '0.92rem', whiteSpace: 'pre-wrap' }}>{it.text}</div>
        </div>
      ))}
      {items.length === 0 && <Empty>No feedback yet.</Empty>}
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
const pill = (on) => ({ padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${on ? ACCENT : '#e6ddd2'}`, background: on ? ACCENT : '#fff', color: on ? '#fff' : '#9b8b77', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' });
const inp = () => ({ padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e6ddd2', fontSize: '0.95rem' });
const lbl = () => ({ color: BROWN, fontWeight: 600, fontSize: '0.88rem' });
const btn = () => ({ padding: '9px 18px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, cursor: 'pointer' });
const danger = () => ({ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e0b4a0', background: '#fff', color: '#b5654a', cursor: 'pointer', fontSize: '0.85rem' });
