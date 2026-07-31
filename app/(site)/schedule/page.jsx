'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

const BROWN = '#6b5b47';
const ACCENT = '#e8a87c';
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FETCH_DAYS = 56; // 8 weeks of availability fetched up front

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d) => addDays(d, -d.getDay()); // Sunday

function fmtBookingTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
function monthDay(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// Minutes-from-midnight → "4:00 PM" (mirrors lib/slots minuteLabel for the client).
function minLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function SchedulePage() {
  const { status } = useSession();
  const loggedIn = status === 'authenticated';

  const [tutors, setTutors] = useState([]);
  const [tutorId, setTutorId] = useState('');
  const [slots, setSlots] = useState(null);
  const [me, setMe] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [picked, setPicked] = useState(null); // slot being confirmed
  const [studentName, setStudentName] = useState('');
  const [recurring, setRecurring] = useState(false); // repeat weekly toggle
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  function closeModal() {
    setPicked(null);
    setRecurring(false);
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

  const loadMe = useCallback(() => {
    if (!loggedIn) return;
    fetch('/api/booking/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d))
      .catch(() => {});
  }, [loggedIn]);
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
    if (!studentName.trim()) { setMsg({ type: 'error', text: 'Enter the student name.' }); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/booking/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: picked.scheduleId, dateKey: picked.dateKey, studentName: studentName.trim(), recurring }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ type: 'error', text: data.error || 'Could not book.' });
      else {
        setMsg({
          type: 'success',
          text: data.recurring
            ? `Weekly session set: ${data.recurring.booked} upcoming session${data.recurring.booked === 1 ? '' : 's'} booked. We'll keep booking it each week.`
            : 'Session booked!',
        });
        closeModal();
        loadMe();
        loadSlots();
      }
    } finally { setBusy(false); }
  }

  async function cancel(bookingId) {
    if (!confirm('Cancel this session? Your session credit will be refunded if it is more than 12 hours away.')) return;
    const res = await fetch('/api/booking/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    });
    if (res.ok) { loadMe(); loadSlots(); }
  }

  async function cancelSeries(recurringId) {
    if (!confirm('Cancel this weekly booking? All upcoming sessions in the series will be cancelled (credits refunded where eligible), and no new weeks will be booked.')) return;
    const res = await fetch('/api/booking/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recurringId, series: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ type: 'success', text: data.message || 'Weekly booking cancelled.' });
      loadMe();
      loadSlots();
    }
  }

  const upcoming = (me?.bookings || []).filter(
    (b) => b.status === 'scheduled' && new Date(b.startAt) >= new Date(),
  );
  const recurringSeries = me?.recurring || [];
  const selectedTutor = tutors.find((t) => t._id === tutorId);

  return (
    <section className="container" style={{ maxWidth: 1000, margin: '48px auto', padding: '0 1rem' }}>
      <h1 style={{ textAlign: 'center', color: BROWN, marginBottom: '0.5rem' }}>Schedule a Session</h1>
      <p style={{ textAlign: 'center', color: '#9b8b77', marginBottom: '1.5rem' }}>
        Pick a tutor and an open time. Each booking uses one of your sessions.
      </p>

      {!loggedIn && (
        <div style={card()}>
          <p style={{ margin: 0, color: BROWN }}>
            You can browse times below. <Link href="/login" style={lnk()}>Log in</Link> or{' '}
            <Link href="/signup" style={lnk()}>sign up</Link> to book.
          </p>
        </div>
      )}

      {loggedIn && (
        <div style={{ ...card(), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={kicker()}>Sessions remaining</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: BROWN }}>{me ? me.totalRemaining : '…'}</div>
          </div>
          {me && me.totalRemaining === 0 && (
            <div style={{ color: '#9b8b77', fontSize: '0.9rem', maxWidth: 380 }}>
              No sessions left. Pay via Zelle and ask us to add sessions to your account.
            </div>
          )}
        </div>
      )}

      {msg && (
        <div style={{ ...card(), background: msg.type === 'error' ? '#fdecea' : '#edf7ed', color: msg.type === 'error' ? '#a3261a' : '#1e6b2e' }}>
          {msg.text}
        </div>
      )}

      {/* Tutor picker */}
      <div style={{ margin: '4px 0 16px' }}>
        {tutors.length === 0 ? (
          <span style={{ color: '#9b8b77' }}>No tutors available yet.</span>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: BROWN, fontWeight: 600 }}>Tutor</span>
            <select
              value={tutorId}
              onChange={(e) => { setTutorId(e.target.value); setWeekOffset(0); }}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e6ddd2', fontSize: '1rem', minWidth: 240, color: BROWN, background: '#fff' }}
            >
              {tutors.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}{t.specialty ? ` · ${t.specialty}` : ''}
                </option>
              ))}
            </select>
            {selectedTutor?.specialty && (
              <span style={{ color: '#9b8b77', fontSize: '0.9rem' }}>{selectedTutor.specialty}</span>
            )}
          </label>
        )}
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} disabled={weekOffset === 0} style={navBtn(weekOffset === 0)}>← Prev</button>
        <strong style={{ color: BROWN }}>{rangeLabel}</strong>
        <button onClick={() => setWeekOffset((w) => Math.min(maxOffset, w + 1))} disabled={weekOffset >= maxOffset} style={navBtn(weekOffset >= maxOffset)}>Next →</button>
      </div>

      {/* 7-column week grid */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(96px, 1fr))', gap: 8, minWidth: 700 }}>
          {weekDays.map((d) => {
            const dk = keyOf(d);
            const isToday = dk === todayKey;
            const daySlots = (byDate[dk] || []).slice().sort((a, b) => a.startMinute - b.startMinute);
            return (
              <div key={dk} style={{ border: `1.5px solid ${isToday ? ACCENT : '#ece5db'}`, borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
                <div style={{ padding: '8px 4px', textAlign: 'center', borderBottom: `1px solid ${isToday ? ACCENT : '#f0ede8'}`, background: isToday ? '#fdf3ec' : '#faf8f5' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9b8b77' }}>{DOW_SHORT[d.getDay()]}</div>
                  <div style={{ fontWeight: 700, color: BROWN, fontSize: '0.95rem' }}>{d.getDate()}</div>
                </div>
                <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 64 }}>
                  {slots === null && <div style={emptyCell()}>…</div>}
                  {slots !== null && daySlots.length === 0 && <div style={emptyCell()}>–</div>}
                  {daySlots.map((s) => (
                    <button
                      key={`${s.scheduleId}-${s.dateKey}`}
                      onClick={() => { if (!loggedIn) { setMsg({ type: 'error', text: 'Please log in to book.' }); return; } setMsg(null); setPicked(s); }}
                      title={loggedIn ? 'Book this time' : 'Log in to book'}
                      style={chip()}
                    >
                      <div style={{ fontWeight: 700, color: BROWN, fontSize: 12 }}>{s.timeLabel.split(' – ')[0]}</div>
                      {s.subject ? <div style={{ fontSize: 10, color: '#9b8b77' }}>{s.subject}</div> : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm modal */}
      {picked && (
        <div style={overlay()} onClick={closeModal}>
          <div style={modal()} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: BROWN, margin: '0 0 4px' }}>Confirm booking</h3>
            <div style={{ color: '#9b8b77', marginBottom: 14 }}>
              {picked.dateLabel} · {picked.timeLabel}
              {picked.subject ? ` · ${picked.subject}` : ''}
            </div>
            <label style={kicker()}>Student name</label>
            <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Which student?" autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e6ddd2', margin: '6px 0 14px', fontSize: '1rem' }} />

            {/* Repeat weekly (progressive disclosure: one-off stays one click) */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${recurring ? ACCENT : '#e6ddd2'}`, background: recurring ? '#fff7f1' : '#fff', cursor: 'pointer', marginBottom: 14 }}>
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                <span style={{ fontWeight: 700, color: BROWN }}>Repeat this weekly</span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#9b8b77' }}>
                  We&apos;ll keep this same time booked every week from your session balance. Cancel anytime.
                </span>
              </span>
            </label>

            {me && (
              <div style={{ fontSize: '0.85rem', color: me.totalRemaining > 0 ? '#1e6b2e' : '#a3261a', marginBottom: 12 }}>
                {me.totalRemaining > 0
                  ? recurring
                    ? `You have ${me.totalRemaining} session${me.totalRemaining === 1 ? '' : 's'}. The next few weeks will be booked now, then one each week until they run out.`
                    : `You have ${me.totalRemaining} session${me.totalRemaining === 1 ? '' : 's'}; one will be used.`
                  : 'You have no sessions left to use.'}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={closeModal} style={ghost()} disabled={busy}>Cancel</button>
              <button onClick={confirmBooking} style={btn()} disabled={busy}>{busy ? 'Booking…' : recurring ? 'Book weekly' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Standing weekly bookings */}
      {loggedIn && recurringSeries.length > 0 && (
        <div style={{ ...card(), marginTop: 24 }}>
          <h2 style={{ color: BROWN, fontSize: '1.2rem', marginTop: 0 }}>Your weekly bookings</h2>
          {recurringSeries.map((r) => (
            <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0ede8', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: BROWN }}>
                  ↻ Every {DOW_SHORT[r.dayOfWeek]} at {minLabel(r.startMinute)}
                  {r.status === 'paused' && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#a3261a', fontWeight: 700 }}>PAUSED: out of sessions</span>}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#9b8b77' }}>
                  {r.studentName} · {r.tutorId?.name || 'Tutor'}{r.subject ? ` · ${r.subject}` : ''}
                </div>
              </div>
              <button onClick={() => cancelSeries(r._id)} style={ghostDanger()}>Cancel weekly</button>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming bookings */}
      {loggedIn && (
        <div style={{ ...card(), marginTop: 24 }}>
          <h2 style={{ color: BROWN, fontSize: '1.2rem', marginTop: 0 }}>Your upcoming sessions</h2>
          {upcoming.length === 0 && <p style={{ color: '#9b8b77', margin: 0 }}>No upcoming sessions.</p>}
          {upcoming.map((b) => (
            <div key={b._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0ede8', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: BROWN }}>
                  {fmtBookingTime(b.startAt)}
                  {b.recurringId && <span title="Part of a weekly booking" style={{ marginLeft: 8, fontSize: '0.72rem', color: ACCENT, fontWeight: 700 }}>↻ weekly</span>}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#9b8b77' }}>
                  {b.studentName} · {b.tutorId?.name || 'Tutor'}{b.subject ? ` · ${b.subject}` : ''}
                </div>
              </div>
              <button onClick={() => cancel(b._id)} style={ghostDanger()}>Cancel</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* styles */
const card = () => ({ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: '1.5rem', marginBottom: 16 });
const kicker = () => ({ fontSize: '0.78rem', color: '#9b8b77', textTransform: 'uppercase', letterSpacing: '0.04em' });
const lnk = () => ({ color: ACCENT, fontWeight: 700 });
const navBtn = (off) => ({ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e6ddd2', background: '#fff', color: off ? '#cbbfb0' : BROWN, fontWeight: 600, cursor: off ? 'not-allowed' : 'pointer' });
const chip = () => ({ width: '100%', textAlign: 'center', borderRadius: 8, border: `1.5px solid ${ACCENT}`, background: '#fff7f1', cursor: 'pointer', padding: '6px 4px' });
const emptyCell = () => ({ textAlign: 'center', color: '#cbbfb0', fontSize: 11, padding: '8px 0', userSelect: 'none' });
const overlay = () => ({ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 });
const modal = () => ({ background: '#fff', borderRadius: 16, padding: '1.6rem', width: '100%', maxWidth: 420, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' });
const btn = () => ({ padding: '9px 18px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, cursor: 'pointer' });
const ghost = () => ({ padding: '9px 16px', borderRadius: 9, border: '1.5px solid #e6ddd2', background: '#fff', color: BROWN, cursor: 'pointer' });
const ghostDanger = () => ({ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e0b4a0', background: '#fff', color: '#b5654a', cursor: 'pointer', fontSize: '0.85rem' });
