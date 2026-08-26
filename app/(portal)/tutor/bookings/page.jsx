'use client';

import { useCallback, useEffect, useState } from 'react';

import LocalTime from '../../LocalTime';

// Family display name, always with the student name(s) attached: "Parent (Student)".
const famName = (f) => {
  if (!f) return 'Family';
  const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
  const kids = (f.students || []).map((s) => s.name).filter(Boolean).join(', ');
  return kids ? `${base} (${kids})` : base;
};

export default function TutorBookingsPage() {
  // In the old tab bar the parent handed this tab a tutorId. Here the page is the
  // top of the tree, so it resolves the signed-in instructor itself. Only the
  // open-slots endpoint needs the id — every /api/tutor/* route reads the session.
  const [tutorId, setTutorId] = useState('');
  const [meState, setMeState] = useState('loading'); // 'loading' | 'ok' | 'unlinked'

  const [bookings, setBookings] = useState([]);
  const [pastBookings, setPastBookings] = useState([]);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
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
    Promise.all([
      fetch('/api/tutor/bookings').then((r) => r.json()).then((d) => setBookings(d.bookings || [])),
      fetch('/api/tutor/bookings?past=1').then((r) => r.json()).then((d) => setPastBookings(d.bookings || [])),
    ])
      .catch(() => {})
      .finally(() => setBookingsLoaded(true));
  }, []);

  const loadSlots = useCallback(() => {
    if (!tutorId) return;
    fetch(`/api/booking/slots?tutorId=${tutorId}&days=56`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []))
      .catch(() => {});
    fetch('/api/tutor/past-slots?days=60')
      .then((r) => r.json())
      .then((d) => setPastSlots(d.slots || []))
      .catch(() => {});
  }, [tutorId]);

  // A login that is not linked to an instructor profile gets tutor: null here and
  // a 403 from every other route, so decide that once and say so plainly.
  useEffect(() => {
    fetch('/api/tutor/me')
      .then((r) => r.json())
      .then((d) => {
        if (d?.tutor?._id) {
          setTutorId(String(d.tutor._id));
          setMeState('ok');
        } else {
          setMeState('unlinked');
        }
      })
      .catch(() => setMeState('unlinked'));
  }, []);

  useEffect(() => {
    if (meState !== 'ok') return;
    loadBookings();
    fetch('/api/tutor/families')
      .then((r) => r.json())
      .then((d) => setFamilies(d.families || []))
      .catch(() => {});
  }, [meState, loadBookings]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  // Switching between "upcoming" and "already happened" swaps the whole slot list,
  // so a slot chosen against the other list must not survive the switch.
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const head = (
    <div className="page-head">
      <div>
        <h1>My bookings</h1>
        <p className="lede">
          Book a student into one of your slots, log someone who turned up without booking, and
          see what is on your schedule.
        </p>
      </div>
    </div>
  );

  // Same shell in every state, so nothing jumps as /api/tutor/me lands.
  if (meState !== 'ok') {
    return (
      <>
        {head}
        {meState === 'unlinked' ? (
          <div className="notice warn">
            Your account isn’t linked to an instructor profile yet, so there are no bookings to
            show. Ask an admin to link you on the Booking Admin → Instructors tab.
          </div>
        ) : (
          <div className="card">
            <div className="empty">
              <span className="ico">📅</span>
              <p>Loading your bookings…</p>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {head}

      {/* ── Book / log a session ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Book a student into a session</h2>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {[['upcoming', 'Upcoming session'], ['past', 'Session that already happened']].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => switchMode(k)}
              aria-pressed={mode === k}
              className={`btn btn-sm ${mode === k ? 'btn-accent' : 'btn-ghost'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {isPast && (
          <p className="muted small" style={{ maxWidth: 520, margin: '0 0 1rem' }}>
            For a student who showed up without booking. The session is recorded as completed and a
            session is deducted; the family isn’t emailed.
          </p>
        )}

        <form onSubmit={book} style={{ maxWidth: 520 }}>
          <div className="field">
            <label htmlFor="tb-family">Family</label>
            <select id="tb-family" value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">Select a family…</option>
              {families.map((f) => (
                <option key={f._id} value={f._id}>{famName(f)} ({f.email})</option>
              ))}
            </select>
            {families.length === 0 && (
              <p className="hint">No families are on file yet.</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="tb-student">Student name</label>
            <input
              id="tb-student"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Which student?"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="tb-slot">{isPast ? 'Which session did they attend?' : 'Time slot'}</label>
            <select id="tb-slot" value={slotKey} onChange={(e) => setSlotKey(e.target.value)} required>
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
          </div>

          {!isPast && (
            <div className="field">
              <label htmlFor="tb-recurring" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                {/* .field inputs are width:100%, which would stretch a checkbox. */}
                <input
                  id="tb-recurring"
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  style={{ width: 'auto', marginTop: 2 }}
                />
                <span>Repeat weekly</span>
              </label>
              <p className="hint">
                Keeps this same weekly time booked from the family’s sessions. Needs a session
                balance to continue.
              </p>
            </div>
          )}

          <button className="btn btn-accent" disabled={busy || !userId || !slotKey}>
            {busy ? (isPast ? 'Recording…' : 'Booking…') : isPast ? 'Record attendance' : recurring ? 'Book weekly' : 'Book session'}
          </button>

          {msg && (
            <div className={`notice ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: '1rem', marginBottom: 0 }}>
              {msg.text}
            </div>
          )}
        </form>
      </div>

      {/* ── Upcoming ─────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Your upcoming bookings</h2>
          {bookingsLoaded && bookings.length > 0 && (
            <span className="muted small">{bookings.length} scheduled</span>
          )}
        </div>

        {!bookingsLoaded ? (
          <div className="empty">
            <span className="ico">📅</span>
            <p>Loading…</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="empty">
            <span className="ico">📅</span>
            <p>No upcoming bookings.</p>
          </div>
        ) : (
          <div className="stack">
            {bookings.map((b) => (
              <div className="row" key={b._id}>
                <div className="main">
                  <span className="strong"><LocalTime iso={b.startAt} /></span>
                  {' · '}{b.studentName}
                  {b.recurringId && (
                    <span className="pill info" title="Part of a weekly booking" style={{ marginLeft: '0.4rem' }}>
                      ↻ weekly
                    </span>
                  )}
                  <div className="meta">{famName(b.userId)}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => cancelBooking(b._id)}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Past ─────────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Past sessions</h2>
        </div>

        {!bookingsLoaded ? (
          <div className="empty">
            <span className="ico">🗂</span>
            <p>Loading…</p>
          </div>
        ) : pastBookings.length === 0 ? (
          <div className="empty">
            <span className="ico">🗂</span>
            <p>No past sessions on record.</p>
          </div>
        ) : (
          <div className="stack">
            {pastBookings.map((b) => (
              <div className="row" key={b._id}>
                <div className="main">
                  <span className="strong"><LocalTime iso={b.startAt} /></span>
                  {' · '}{b.studentName}
                  {b.status === 'completed' && (
                    <span className="pill ok" title="Attendance logged after the session" style={{ marginLeft: '0.4rem' }}>
                      ✓ logged
                    </span>
                  )}
                  <div className="meta">{famName(b.userId)}</div>
                </div>
                {/* Only a logged session can be undone here; removing one that was booked
                    normally would refund a credit for a session actually delivered. */}
                {b.status === 'completed' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => cancelBooking(b._id, true)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
