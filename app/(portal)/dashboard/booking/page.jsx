'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LocalTime from '../../LocalTime';
import {
  PRIVATE,
  SEMI_PRIVATE,
  SESSION_TYPE_BLURB,
  inferSlotType,
  sessionTypeLabel,
} from '@/lib/sessionTypes';

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

// "semi-private" / "private" as they read mid-sentence. sessionTypeLabel() is
// the title-case heading form and carries the "(1:1)" gloss, which reads badly
// inside a paragraph — and this matches the wording the booking API already
// uses in its out-of-credits message, so the two never contradict each other.
const kindNoun = (t) => (t === PRIVATE ? 'private' : 'semi-private');

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

  // Credits are per instructor AND per kind: one bought for Yesol cannot book
  // Won, and one bought for a semi-private seat cannot pay for a private slot.
  // A single grand total would promise sessions this slot cannot draw on, so
  // what is counted here is only what the instructor currently selected can
  // take, split by the kind of slot it may pay for.
  //
  // A credit with no kind was granted before kinds existed. It is not missing
  // data — it works for EITHER kind — so it gets its own bucket and is added to
  // whichever kind is being spent.
  const spendable = useMemo(() => {
    if (!me) return null;

    // byTutorAndType is keyed "<tutorId>|<type>", where either half may be the
    // literal "any" (no instructor / no kind). Fall back to reading the raw
    // grants if it is missing, rather than telling a family their balance is
    // zero because one field did not come back.
    const map = me.byTutorAndType;
    const rows =
      map && typeof map === 'object'
        ? Object.entries(map).map(([key, left]) => {
            const cut = key.lastIndexOf('|');
            return { tid: key.slice(0, cut), type: key.slice(cut + 1), left: left || 0 };
          })
        : (me.credits || []).map((g) => ({
            tid: g.tutorId ? String(g.tutorId._id ?? g.tutorId) : 'any',
            type: g.sessionType || 'any',
            left: g.remainingSessions || 0,
          }));

    const buckets = { [SEMI_PRIVATE]: 0, [PRIVATE]: 0, any: 0 };
    for (const r of rows) {
      if (r.left <= 0) continue;
      // "any" here is the instructor half: a credit usable with anybody.
      if (r.tid !== 'any' && r.tid !== tutorId) continue;
      // Ignore a kind this build does not know about instead of mis-filing it.
      if (r.type in buckets) buckets[r.type] += r.left;
    }

    return {
      semiPrivate: buckets[SEMI_PRIVATE],
      private: buckets[PRIVATE],
      either: buckets.any,
      // What a slot of this kind can actually be paid with.
      forType: (t) => (buckets[t] || 0) + buckets.any,
      total: buckets[SEMI_PRIVATE] + buckets[PRIVATE] + buckets.any,
    };
  }, [me, tutorId]);

  // The kind of the slot being confirmed. inferSlotType covers a slot opened
  // before slots carried a kind, so this is never null while a slot is picked.
  const pickedType = picked ? inferSlotType(picked) : null;

  // Once a slot is picked the headline number is the one that slot would draw
  // on; with nothing picked it is everything this instructor can take.
  const remaining = spendable ? (pickedType ? spendable.forType(pickedType) : spendable.total) : null;

  const balanceLabel = pickedType
    ? `${sessionTypeLabel(pickedType)}${selectedTutor ? ` with ${selectedTutor.name}` : ''} (남은 수업)`
    : selectedTutor
      ? `Sessions with ${selectedTutor.name} (남은 수업)`
      : 'Sessions remaining (남은 수업)';

  // The line under the balance. With a slot picked it talks only about that
  // slot's kind, because that is the only bucket the booking can spend from.
  const balanceHint = (() => {
    if (!spendable) return '';
    if (pickedType) {
      if (remaining === 0) {
        return `No ${kindNoun(pickedType)} sessions left${selectedTutor ? ` with ${selectedTutor.name}` : ''}. That time can only be paid for with ${kindNoun(pickedType)} credits.`;
      }
      return spendable.either > 0
        ? `${remaining} can pay for the ${kindNoun(pickedType)} time you picked, including ${spendable.either} that work with either kind.`
        : `${remaining} can pay for the ${kindNoun(pickedType)} time you picked.`;
    }
    if (spendable.total === 0) {
      return selectedTutor
        ? `You have no sessions left with ${selectedTutor.name}.`
        : 'You have no sessions left to use.';
    }
    return 'One session per booking; a private session uses two.';
  })();

  // Rendered in whichever place the family is actually looking: the confirm
  // modal covers the page, so a failure raised from inside it has to appear
  // inside it. The text is always the server's own — the 402 is already worded
  // per kind ("You have no private sessions left…"), and a generic replacement
  // would hide the one thing that explains the refusal.
  const msgNotice = msg ? (
    <div className={`notice ${msg.type === 'err' ? 'err' : 'ok'}`}>
      {msg.text}
      {msg.buyCredits && (
        <> <Link href="/dashboard/credits" className="strong">Buy more credits →</Link></>
      )}
    </div>
  ) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Book a 1:1 session</h1>
          <p className="lede">
            Pick an instructor and an open time. Each booking uses one of your session credits.
            Group classes are arranged with the school, not booked here.
          </p>
        </div>
      </div>

      {/* Balance up top: booking is the thing that spends credits, so the way to
          buy more sits right next to the number. */}
      <div className="grid grid-2" style={{ marginBottom: '1.1rem' }}>
        <div className="stat">
          <div className="label">{balanceLabel}</div>
          <div className="value">{remaining === null ? '…' : remaining}</div>
          {/* Split by kind, always all three rows so the card keeps its height
              while /api/booking/me is still in flight. */}
          <div style={kindRowStyle}>
            <span className="pill mute" title="Credits that can pay for a semi-private time">
              Semi-private · {spendable ? spendable.semiPrivate : '…'}
            </span>
            <span className="pill info" title="Credits that can pay for a private time">
              Private · {spendable ? spendable.private : '…'}
            </span>
            <span className="pill ok" title="Bought before the two kinds were sold separately — these work for either">
              Either kind · {spendable ? spendable.either : '…'}
            </span>
          </div>
          <div className="hint" style={{ marginBottom: '0.7rem' }}>{balanceHint}</div>
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

      {!picked && msgNotice}

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
                        {daySlots.map((s) => {
                          // Semi-private and private are separate products at
                          // separate rates, so the kind has to be legible before
                          // the click — nobody should open a private slot
                          // expecting the group price.
                          const type = inferSlotType(s);
                          const isPrivateSlot = type === PRIVATE;
                          return (
                            <button
                              key={`${s.scheduleId}-${s.dateKey}`}
                              type="button"
                              onClick={() => { setMsg(null); setPicked(s); }}
                              title={`Book this ${kindNoun(type)} time`}
                              style={isPrivateSlot ? privateChipStyle : chipStyle}
                            >
                              <span className="strong" style={{ fontSize: '0.78rem' }}>
                                {s.timeLabel.split(' – ')[0]}
                              </span>
                              <span style={kindTagStyle(isPrivateSlot)}>
                                {isPrivateSlot ? 'Private' : 'Semi-private'}
                              </span>
                              {s.subject ? (
                                <span className="muted" style={{ display: 'block', fontSize: '0.66rem' }}>{s.subject}</span>
                              ) : null}
                            </button>
                          );
                        })}
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
            <p className="muted small" style={{ margin: '-0.5rem 0 0.5rem' }}>
              {picked.dateLabel} · {picked.timeLabel}
              {picked.subject ? ` · ${picked.subject}` : ''}
            </p>

            {/* Which product this is, and which credit it comes out of. The two
                kinds are priced separately, so both belong on the last screen
                before the family commits. */}
            <div style={{ margin: '0 0 1rem' }}>
              <span className={`pill ${pickedType === PRIVATE ? 'info' : 'mute'}`}>
                {sessionTypeLabel(pickedType)}
              </span>
              <span className="muted small" style={{ display: 'block', marginTop: '0.35rem' }}>
                {SESSION_TYPE_BLURB[pickedType]}
              </span>
              <span className="small strong" style={{ display: 'block', marginTop: '0.15rem' }}>
                Pays with a {kindNoun(pickedType)} credit
                {spendable && spendable.either > 0 ? ' (your either-kind credits also work)' : ''}.
              </span>
            </div>

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

            {/* Counted against this slot's kind, not the grand total: a balance
                of ten semi-private sessions buys nothing on a private slot. */}
            {spendable && (
              <div className={`notice ${remaining > 0 ? 'info' : 'err'}`} style={{ margin: '0.9rem 0' }}>
                {remaining > 0
                  ? privateSession
                    ? `You have ${remaining} ${kindNoun(pickedType)} session${plural(remaining)}; a private session uses 2.${remaining < 2 ? ' You need at least 2.' : ''}`
                    : recurring
                      ? `You have ${remaining} ${kindNoun(pickedType)} session${plural(remaining)}. The next few weeks will be booked now, then one each week until they run out.`
                      : `You have ${remaining} ${kindNoun(pickedType)} session${plural(remaining)}; one will be used.`
                  : (
                    <>
                      You have no {kindNoun(pickedType)} sessions left to use.{' '}
                      <Link href="/dashboard/credits" className="strong">Buy more credits →</Link>
                    </>
                  )}
              </div>
            )}

            {msgNotice}

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

// A private slot is a different product at a different rate, so it must not
// look like the accent-coloured group chip a family is used to clicking. The
// blue reads as "other kind" at a glance across a whole week of the grid, and
// the label under the time says which one it is up close.
const privateChipStyle = {
  ...chipStyle,
  border: '1px solid var(--info)',
  background: 'var(--info-bg)',
};

// Too narrow a cell for a .pill (it would overflow at 92px), so the kind rides
// as a small caps label instead.
const kindTagStyle = (isPrivateSlot) => ({
  display: 'block',
  fontSize: '0.6rem',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: isPrivateSlot ? 'var(--info)' : 'var(--accent-ink)',
});

const kindRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.3rem 0.35rem',
  margin: '0.45rem 0 0.15rem',
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
