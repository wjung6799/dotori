'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LocalTime from '../../LocalTime';

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FETCH_DAYS = 56; // 8 weeks of availability fetched up front

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d) => addDays(d, -d.getDay()); // Sunday

function monthDay(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Minutes-from-midnight → "4:00 PM" (mirrors lib/slots minuteLabel for the client).
function minLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${ampm}`;
}

const plural = (n) => (n === 1 ? '' : 's');

export default function BookingPage() {
  const [tutors, setTutors] = useState([]);
  const [tutorId, setTutorId] = useState('');
  const [slots, setSlots] = useState(null); // null = still loading
  const [me, setMe] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [picked, setPicked] = useState(null); // slot being confirmed
  const [studentName, setStudentName] = useState('');
  const [recurring, setRecurring] = useState(false); // repeat weekly toggle
  const [privateSession, setPrivateSession] = useState(false); // whole-slot private booking
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  function closeModal() {
    setPicked(null);
    setRecurring(false);
    setPrivateSession(false);
  }

  useEffect(() => {
    fetch('/api/booking/tutors')
      .then((r) => r.json())
      .then((d) => {
        setTutors(d.tutors || []);
        if (d.tutors?.length) setTutorId(d.tutors[0]._id);
      })
      .catch(() => setTutors([]));
  }, []);

  // The portal is always authenticated, so this can load unconditionally.
  const loadMe = useCallback(() => {
    fetch('/api/booking/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d))
      .catch(() => {});
  }, []);
  useEffect(() => { loadMe(); }, [loadMe]);

  const loadSlots = useCallback(() => {
    if (!tutorId) return;
    setSlots(null);
    fetch(`/api/booking/slots?tutorId=${tutorId}&days=${FETCH_DAYS}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []))
      .catch(() => setSlots([]));
  }, [tutorId]);
  useEffect(() => { loadSlots(); }, [loadSlots]);

  // Index slots by their dateKey for quick per-day lookup.
  const byDate = useMemo(() => {
    const map = {};
    (slots || []).forEach((s) => {
      (map[s.dateKey] = map[s.dateKey] || []).push(s);
    });
    return map;
  }, [slots]);

  const today = useMemo(() => new Date(), []);
  const thisWeekStart = useMemo(() => startOfWeek(today), [today]);
  const weekStart = addDays(thisWeekStart, weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = keyOf(today);

  const maxOffset = Math.floor((FETCH_DAYS - 1) / 7);
  const rangeLabel = `${monthDay(weekDays[0])} – ${monthDay(weekDays[6])}`;

  async function confirmBooking() {
    if (!picked) return;
    setMsg(null);
    if (!studentName.trim()) {
      setMsg({ type: 'err', text: 'Enter the student name.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/booking/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: picked.scheduleId,
          dateKey: picked.dateKey,
          studentName: studentName.trim(),
          recurring,
          isPrivate: privateSession,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 402 is the out-of-credits case. Families can top up themselves now,
        // so point them straight at the credits page instead of the office.
        setMsg({
          type: 'err',
          text: data.error || 'Could not book.',
          buyCredits: res.status === 402,
        });
      } else {
        setMsg({
          type: 'ok',
          text: data.recurring
            ? `Weekly session set: ${data.recurring.booked} upcoming session${plural(data.recurring.booked)} booked. We'll keep booking it each week.`
            : data.isPrivate
              ? 'Private session booked! 2 sessions were used.'
              : 'Session booked!',
        });
        closeModal();
        loadMe();
        loadSlots();
      }
    } catch {
      setMsg({ type: 'err', text: 'Could not reach the server. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(bookingId) {
    if (!confirm('Cancel this session? Your session credit will be refunded if it is more than 12 hours away.')) return;
    const res = await fetch('/api/booking/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    });
    if (res.ok) {
      loadMe();
      loadSlots();
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error || 'Could not cancel that session.' });
    }
  }

  async function cancelSeries(recurringId) {
    if (!confirm('Cancel this weekly booking? All upcoming sessions in the series will be cancelled (credits refunded where eligible), and no new weeks will be booked.')) return;
    const res = await fetch('/api/booking/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recurringId, series: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ type: 'ok', text: data.message || 'Weekly booking cancelled.' });
      loadMe();
      loadSlots();
    } else {
      setMsg({ type: 'err', text: data.error || 'Could not cancel that weekly booking.' });
    }
  }

  // /api/booking/me sorts newest-first; soonest-first reads better as a to-do list.
  const upcoming = (me?.bookings || [])
    .filter((b) => b.status === 'scheduled' && new Date(b.startAt) >= new Date())
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const recurringSeries = me?.recurring || [];
  const selectedTutor = tutors.find((t) => t._id === tutorId);
  const remaining = me ? me.totalRemaining : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Book a session</h1>
          <p className="lede">
            Pick an instructor and an open time. Each booking uses one of your sessions.
          </p>
        </div>
      </div>

      {/* Balance up top: booking is the thing that spends credits, so the way to
          buy more sits right next to the number. */}
      <div className="grid grid-2" style={{ marginBottom: '1.1rem' }}>
        <div className="stat">
          <div className="label">Sessions remaining (남은 수업)</div>
          <div className="value">{remaining === null ? '…' : remaining}</div>
          <div className="hint" style={{ marginBottom: '0.7rem' }}>
            {remaining === 0
              ? 'You have no sessions left to use.'
              : 'One session per booking; a private session uses two.'}
          </div>
          <Link href="/dashboard/credits" className="btn btn-accent btn-sm">Buy more credits</Link>
        </div>

        <div className="stat">
          <div className="label">Upcoming sessions</div>
          <div className="value">{me ? upcoming.length : '…'}</div>
          <div className="hint">
            {me && upcoming.length > 0
              ? <>Next: <LocalTime iso={upcoming[0].startAt} /></>
              : 'Nothing booked yet.'}
          </div>
        </div>
      </div>

      {msg && (
        <div className={`notice ${msg.type === 'err' ? 'err' : 'ok'}`}>
          {msg.text}
          {msg.buyCredits && (
            <> <Link href="/dashboard/credits" className="strong">Buy more credits →</Link></>
          )}
        </div>
      )}

      {/* Slot picker */}
      <div className="card">
        <div className="card-head">
          <h2>Open times</h2>
          <span className="link muted">{rangeLabel}</span>
        </div>

        {tutors.length === 0 ? (
          <div className="empty">
            <span className="ico">🧑‍🏫</span>
            <p>No instructors are taking bookings right now. Please check back soon.</p>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="tutor">Instructor (선생님)</label>
              <select
                id="tutor"
                value={tutorId}
                onChange={(e) => { setTutorId(e.target.value); setWeekOffset(0); }}
              >
                {tutors.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}{t.specialty ? ` · ${t.specialty}` : ''}
                  </option>
                ))}
              </select>
              {selectedTutor?.specialty && <div className="hint">{selectedTutor.specialty}</div>}
            </div>

            {/* Week navigation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                marginBottom: '0.7rem',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                disabled={weekOffset === 0}
              >
                ← Prev
              </button>
              <strong className="strong">{rangeLabel}</strong>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setWeekOffset((w) => Math.min(maxOffset, w + 1))}
                disabled={weekOffset >= maxOffset}
              >
                Next →
              </button>
            </div>

            {/* 7-column week grid. Fixed at 7 columns, so it scrolls sideways in
                .table-wrap on a phone rather than reflowing into an auto-fit grid. */}
            <div className="table-wrap">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(92px, 1fr))',
                  gap: '0.4rem',
                  minWidth: 660,
                }}
              >
                {weekDays.map((d) => {
                  const dk = keyOf(d);
                  const isToday = dk === todayKey;
                  const daySlots = (byDate[dk] || []).slice().sort((a, b) => a.startMinute - b.startMinute);
                  return (
                    <div
                      key={dk}
                      style={{
                        border: `1px solid ${isToday ? 'var(--accent)' : 'var(--line)'}`,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '0.35rem 0.25rem',
                          textAlign: 'center',
                          borderBottom: `1px solid ${isToday ? 'var(--accent)' : 'var(--line-soft)'}`,
                          background: isToday ? '#fff8f0' : 'var(--surface-2)',
                        }}
                      >
                        <div
                          className="muted"
                          style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}
                        >
                          {DOW_SHORT[d.getDay()]}
                        </div>
                        <div className="strong" style={{ fontSize: '0.95rem' }}>{d.getDate()}</div>
                      </div>

                      <div style={{ padding: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', minHeight: 72 }}>
                        {slots === null && <div style={emptyCell}>…</div>}
                        {slots !== null && daySlots.length === 0 && <div style={emptyCell}>–</div>}
                        {daySlots.map((s) => (
                          <button
                            key={`${s.scheduleId}-${s.dateKey}`}
                            type="button"
                            onClick={() => { setMsg(null); setPicked(s); }}
                            title="Book this time"
                            style={chipStyle}
                          >
                            <span className="strong" style={{ fontSize: '0.78rem' }}>
                              {s.timeLabel.split(' – ')[0]}
                            </span>
                            {s.subject ? (
                              <span className="muted" style={{ display: 'block', fontSize: '0.66rem' }}>{s.subject}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirm modal */}
      {picked && (
        <div style={overlayStyle} onClick={closeModal} role="presentation">
          <div className="card mb0" style={modalStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="card-head">
              <h2>Confirm booking</h2>
            </div>
            <p className="muted small" style={{ margin: '-0.5rem 0 1rem' }}>
              {picked.dateLabel} · {picked.timeLabel}
              {picked.subject ? ` · ${picked.subject}` : ''}
            </p>

            <div className="field">
              <label htmlFor="studentName">Student name (학생 이름)</label>
              <input
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Which student?"
                autoFocus
              />
            </div>

            {/* Repeat weekly (progressive disclosure: one-off stays one click) */}
            <label style={toggleStyle(recurring)}>
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => { setRecurring(e.target.checked); if (e.target.checked) setPrivateSession(false); }}
                style={{ marginTop: 3 }}
              />
              <span>
                <span className="strong">Repeat this weekly</span>
                <span className="muted small" style={{ display: 'block' }}>
                  We&apos;ll keep this same time booked every week from your session balance. Cancel anytime.
                </span>
              </span>
            </label>

            {/* Private session: books the whole slot exclusively, uses 2 sessions. */}
            <label style={toggleStyle(privateSession)}>
              <input
                type="checkbox"
                checked={privateSession}
                onChange={(e) => { setPrivateSession(e.target.checked); if (e.target.checked) setRecurring(false); }}
                style={{ marginTop: 3 }}
              />
              <span>
                <span className="strong">Make this a private session</span>
                <span className="muted small" style={{ display: 'block' }}>
                  Reserves this time just for your student. Uses <strong>2 sessions</strong>. Only available if no one else has booked it yet.
                </span>
              </span>
            </label>

            {me && (
              <div className={`notice ${me.totalRemaining > 0 ? 'info' : 'err'}`} style={{ margin: '0.9rem 0' }}>
                {me.totalRemaining > 0
                  ? privateSession
                    ? `You have ${me.totalRemaining} session${plural(me.totalRemaining)}; a private session uses 2.${me.totalRemaining < 2 ? ' You need at least 2.' : ''}`
                    : recurring
                      ? `You have ${me.totalRemaining} session${plural(me.totalRemaining)}. The next few weeks will be booked now, then one each week until they run out.`
                      : `You have ${me.totalRemaining} session${plural(me.totalRemaining)}; one will be used.`
                  : (
                    <>
                      You have no sessions left to use.{' '}
                      <Link href="/dashboard/credits" className="strong">Buy more credits →</Link>
                    </>
                  )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={confirmBooking} disabled={busy}>
                {busy ? 'Booking…' : recurring ? 'Book weekly' : privateSession ? 'Book private' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standing weekly bookings */}
      {recurringSeries.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>Your weekly bookings</h2>
          </div>
          <div className="stack">
            {recurringSeries.map((r) => (
              <div className="row" key={r._id}>
                <div className="main">
                  <div className="strong">
                    ↻ Every {DOW_SHORT[r.dayOfWeek]} at {minLabel(r.startMinute)}
                    {r.status === 'paused' && (
                      <span className="pill err" style={{ marginLeft: '0.5rem' }}>Paused · out of sessions</span>
                    )}
                  </div>
                  <div className="meta">
                    {r.studentName} · {r.tutorId?.name || 'Tutor'}{r.subject ? ` · ${r.subject}` : ''}
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancelSeries(r._id)}>
                  Cancel weekly
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming bookings */}
      <div className="card">
        <div className="card-head">
          <h2>Your upcoming sessions</h2>
        </div>
        {!me ? (
          // Stable placeholder so the card doesn't jump once /api/booking/me lands.
          <div className="empty"><span className="ico">🗓</span><p>Loading your sessions…</p></div>
        ) : upcoming.length === 0 ? (
          <div className="empty">
            <span className="ico">🗓</span>
            <p>No upcoming sessions. Pick an open time above to book one.</p>
          </div>
        ) : (
          <div className="stack">
            {upcoming.map((b) => (
              <div className="row" key={b._id}>
                <div className="main">
                  <div className="strong">
                    <LocalTime iso={b.startAt} />
                    {b.recurringId && (
                      <span className="pill info" style={{ marginLeft: '0.5rem' }} title="Part of a weekly booking">↻ weekly</span>
                    )}
                    {b.isPrivate && (
                      <span className="pill warn" style={{ marginLeft: '0.5rem' }} title="Private session (whole slot, 2 sessions)">★ private</span>
                    )}
                  </div>
                  <div className="meta">
                    {b.studentName} · {b.tutorId?.name || 'Tutor'}{b.subject ? ` · ${b.subject}` : ''}
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancel(b._id)}>Cancel</button>
              </div>
            ))}
          </div>
        )}
        <p className="muted small mb0" style={{ marginTop: '0.9rem' }}>
          Cancel at least 12 hours ahead and the session credit goes back to your balance.
        </p>
      </div>
    </>
  );
}

/* One-off styles with no portal.css equivalent (calendar cells, modal chrome). */
const emptyCell = {
  textAlign: 'center',
  color: 'var(--ink-3)',
  fontSize: '0.7rem',
  padding: '0.5rem 0',
  userSelect: 'none',
};

const chipStyle = {
  width: '100%',
  textAlign: 'center',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-sm)',
  background: '#fff8f0',
  color: 'var(--brown-dark)',
  font: 'inherit',
  cursor: 'pointer',
  padding: '0.3rem 0.2rem',
  lineHeight: 1.25,
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 60, // above the sidebar (z-index 40) and the drawer scrim (35)
  background: 'rgba(47, 39, 23, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  overflowY: 'auto',
};

const modalStyle = {
  width: '100%',
  maxWidth: 440,
  maxHeight: '92vh',
  overflowY: 'auto',
  boxShadow: '0 18px 50px rgba(47, 39, 23, 0.28)',
};

const toggleStyle = (on) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.6rem',
  padding: '0.6rem 0.75rem',
  borderRadius: 'var(--radius-sm)',
  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
  background: on ? '#fff8f0' : 'var(--surface)',
  cursor: 'pointer',
  marginBottom: '0.6rem',
});
