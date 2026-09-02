'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scheduleMatchesDate, recurrenceLabel } from '@/lib/slots';

const BROWN = '#6b5b47';
const ACCENT = '#e8a87c';
const GREEN = '#7cbf8e';
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_PX = 46;
const PX_PER_MIN = HOUR_PX / 60;
const CONTENT_H = (END_HOUR - START_HOUR) * HOUR_PX;
const VIEWPORT_H = 560;
const GUTTER = 52;
const SNAP = 15;

// What a slot can open as when nobody has narrowed it down.
const DEFAULT_KINDS = [
  { type: 'semi_private', label: 'Semi-private', hint: 'A small group shares the time.' },
  { type: 'private', label: 'Private (1:1)', hint: 'One student has the whole time.' },
];
const WEEKS_AHEAD = 8;
const DEFAULT_DUR = 60;

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d) => addDays(d, -d.getDay());
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const snap = (m) => Math.round(m / SNAP) * SNAP;
const minuteLabel = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${pad(m)} ${ampm}`;
};
const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const fromHHMM = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

// Google-Calendar-style availability editor. Drag down a day column to create a
// slot; click an existing slot to remove it. Same props as before so the tutor
// dashboard and admin page use it unchanged.
export default function AvailabilityCalendar({
  schedules = [],
  exceptions = [],
  onAddSlot,        // async ({ mode:'recurring'|'oneoff', dayOfWeek, specificDate, startMinute, durationMinutes, capacity, sessionType, subject })
  onCancelInstance, // async (scheduleId, dateKey)
  onDeleteSeries,   // async (scheduleId)
  onStopSeries,     // async (scheduleId) — stop future openings, keep booked sessions
  // The kinds a paid slot may open as: [{ type, label, hint }]. The tutor page
  // derives this from the packages the tutor actually sells, so a slot can only
  // be opened as something a family can buy a credit for. Left out (the admin
  // page), both kinds are offered.
  kinds = DEFAULT_KINDS,
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [preview, setPreview] = useState(null);   // { columnIdx, startMin, curMin }
  const [creating, setCreating] = useState(null);  // { date, dow, startMin, durMin }
  const [picked, setPicked] = useState(null);      // an existing occurrence
  const dragRef = useRef(null);
  const scrollRef = useRef(null);
  const didScroll = useRef(false);

  const today = useMemo(() => new Date(), []);
  const weekStart = addDays(startOfWeek(today), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = keyOf(today);
  const exSet = useMemo(() => new Set(exceptions.map((e) => `${e.scheduleId}|${e.date}`)), [exceptions]);

  const occForDay = useCallback((day) => {
    const dk = keyOf(day);
    const out = [];
    for (const s of schedules) {
      if (s.active === false) continue;
      if (!scheduleMatchesDate(s, dk) || exSet.has(`${s._id}|${dk}`)) continue;
      out.push({ ...s, dateKey: dk });
    }
    return out;
  }, [schedules, exSet]);

  // Auto-scroll to the earliest scheduled slot (or 8 AM) once data is present.
  useEffect(() => {
    if (didScroll.current || !scrollRef.current) return;
    if (!schedules.length) return;
    const earliest = Math.min(...schedules.map((s) => s.startMinute));
    const target = (clamp(earliest - 60, START_HOUR * 60, END_HOUR * 60) - START_HOUR * 60) * PX_PER_MIN;
    scrollRef.current.scrollTop = Math.max(0, target);
    didScroll.current = true;
  }, [schedules]);

  const yToMin = (clientY, colTop) =>
    snap(clamp((clientY - colTop) / PX_PER_MIN + START_HOUR * 60, START_HOUR * 60, END_HOUR * 60));

  function onColDown(e, day, idx) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const m = yToMin(e.clientY, rect.top);
    dragRef.current = { active: true, columnIdx: idx, date: keyOf(day), dow: day.getDay(), startMin: m, curMin: m, colTop: rect.top };
    setPreview({ columnIdx: idx, startMin: m, curMin: m });
    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
  }
  const onWinMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d?.active) return;
    const m = yToMin(e.clientY, d.colTop);
    d.curMin = m;
    setPreview({ columnIdx: d.columnIdx, startMin: d.startMin, curMin: m });
  }, []);
  const onWinUp = useCallback(() => {
    const d = dragRef.current;
    window.removeEventListener('pointermove', onWinMove);
    window.removeEventListener('pointerup', onWinUp);
    if (!d?.active) return;
    d.active = false;
    setPreview(null);
    let start = Math.min(d.startMin, d.curMin);
    let end = Math.max(d.startMin, d.curMin);
    if (end - start < SNAP) end = Math.min(START_HOUR * 60 + (END_HOUR - START_HOUR) * 60, start + DEFAULT_DUR);
    setCreating({ date: d.date, dow: d.dow, startMin: start, durMin: end - start });
  }, [onWinMove]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', onWinMove);
    window.removeEventListener('pointerup', onWinUp);
  }, [onWinMove, onWinUp]);

  const colTemplate = `${GUTTER}px repeat(7, minmax(92px, 1fr))`;

  return (
    <div>
      {/* Week nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={() => setWeekOffset((w) => Math.max(-1, w - 1))} style={navBtn()}>← Prev</button>
        <strong style={{ color: BROWN }}>
          {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </strong>
        <button onClick={() => setWeekOffset((w) => Math.min(WEEKS_AHEAD, w + 1))} style={navBtn()}>Next →</button>
      </div>
      <p style={{ color: '#9b8b77', fontSize: '0.8rem', margin: '0 0 8px' }}>
        Drag down a day to create availability. Click a slot to remove it. Times are in the site timezone.
      </p>

      <div ref={scrollRef} style={{ height: VIEWPORT_H, overflow: 'auto', border: '1px solid #ece5db', borderRadius: 12, background: '#fff' }}>
        <div style={{ minWidth: 760 }}>
          {/* Sticky day headers */}
          <div style={{ position: 'sticky', top: 0, zIndex: 3, display: 'grid', gridTemplateColumns: colTemplate, background: '#faf8f5', borderBottom: '1px solid #ece5db' }}>
            <div />
            {weekDays.map((d) => {
              const isToday = keyOf(d) === todayKey;
              return (
                <div key={keyOf(d)} style={{ textAlign: 'center', padding: '6px 2px', borderLeft: '1px solid #f0ede8', background: isToday ? '#fdf3ec' : 'transparent' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#9b8b77' }}>{DOW_SHORT[d.getDay()]}</div>
                  <div style={{ fontWeight: 700, color: BROWN }}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div style={{ display: 'grid', gridTemplateColumns: colTemplate, height: CONTENT_H, position: 'relative' }}>
            {/* Time gutter */}
            <div style={{ position: 'relative' }}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i).map((h) => (
                <div key={h} style={{ position: 'absolute', top: (h - START_HOUR) * HOUR_PX - 6, right: 6, fontSize: 10, color: '#b0a594' }}>
                  {h === 0 ? '' : minuteLabel(h * 60)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, idx) => {
              const occ = occForDay(day);
              const isPrevCol = preview && preview.columnIdx === idx;
              const pStart = isPrevCol ? Math.min(preview.startMin, preview.curMin) : 0;
              const pEnd = isPrevCol ? Math.max(preview.startMin, preview.curMin) : 0;
              return (
                <div
                  key={keyOf(day)}
                  onPointerDown={(e) => onColDown(e, day, idx)}
                  style={{ position: 'relative', borderLeft: '1px solid #f0ede8', touchAction: 'none', cursor: 'crosshair' }}
                >
                  {/* hour lines */}
                  {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i).map((i) => (
                    <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * HOUR_PX, borderTop: '1px solid #f5f1ec' }} />
                  ))}

                  {/* existing slots */}
                  {occ.map((o) => {
                    const top = (o.startMinute - START_HOUR * 60) * PX_PER_MIN;
                    const height = Math.max(16, (o.durationMinutes || 60) * PX_PER_MIN - 2);
                    const oneoff = !!o.specificDate;
                    return (
                      <button
                        key={`${o._id}-${o.dateKey}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setPicked(o)}
                        title="Click to remove"
                        style={{
                          position: 'absolute', top, left: 3, right: 3, height, overflow: 'hidden',
                          borderRadius: 6, border: `1.5px solid ${oneoff ? GREEN : ACCENT}`,
                          background: oneoff ? '#eef7ea' : '#fff3ea', cursor: 'pointer', padding: '2px 4px', textAlign: 'left',
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 700, color: BROWN }}>{minuteLabel(o.startMinute)}</div>
                        {o.subject ? <div style={{ fontSize: 9, color: '#9b8b77' }}>{o.subject}</div> : null}
                        <div style={{ fontSize: 8, color: '#b0a594' }}>{recurrenceLabel(o)}{o.capacity > 1 ? ` · ${o.capacity}` : ''}</div>
                      </button>
                    );
                  })}

                  {/* drag preview */}
                  {isPrevCol && pEnd > pStart && (
                    <div style={{ position: 'absolute', top: (pStart - START_HOUR * 60) * PX_PER_MIN, left: 3, right: 3, height: (pEnd - pStart) * PX_PER_MIN, borderRadius: 6, border: `1.5px dashed ${ACCENT}`, background: 'rgba(232,168,124,0.25)', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: BROWN, padding: '2px 4px' }}>
                        {minuteLabel(pStart)}–{minuteLabel(pEnd)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Create modal (after drag) */}
      {creating && (
        <CreateModal
          kinds={kinds}
          creating={creating}
          onClose={() => setCreating(null)}
          onSubmit={async (payload) => { await onAddSlot(payload); setCreating(null); }}
        />
      )}

      {/* Remove modal (click existing) */}
      {picked && (
        <div style={overlay()} onClick={() => setPicked(null)}>
          <div style={modal()} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: BROWN, margin: '0 0 4px' }}>Remove availability</h3>
            <div style={{ color: '#9b8b77', marginBottom: 14 }}>
              {new Date(picked.dateKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              {' · '}{minuteLabel(picked.startMinute)}–{minuteLabel(picked.startMinute + (picked.durationMinutes || 60))}
              {picked.subject ? ` · ${picked.subject}` : ''}
            </div>
            {!picked.specificDate && onStopSeries && (
              <>
                <p style={{ color: '#9b8b77', fontSize: '0.84rem', marginTop: 0 }}>
                  Stop offering this time from now on. Sessions families have already booked stay
                  on the calendar exactly as they are — nothing is cancelled or refunded — but no
                  new sessions can be booked into it.
                </p>
                <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                  <button
                    onClick={async () => {
                      if (confirm('Stop this repeating series? Already-booked sessions are kept.')) {
                        await onStopSeries(picked._id); setPicked(null);
                      }
                    }}
                    style={btn()}
                  >
                    Stop future openings (keep booked sessions)
                  </button>
                </div>
              </>
            )}
            <p style={{ color: '#9b8b77', fontSize: '0.84rem', marginTop: 0 }}>
              Any session already booked for the removed time(s) will be cancelled and the family&apos;s session refunded.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button onClick={async () => { await onCancelInstance(picked._id, picked.dateKey); setPicked(null); }} style={btn()}>
                Remove just this date
              </button>
              <button
                onClick={async () => {
                  const msg = picked.specificDate ? 'Delete this one-off slot?' : 'Delete the entire repeating series?';
                  if (confirm(msg)) { await onDeleteSeries(picked._id); setPicked(null); }
                }}
                style={dangerBtn()}
              >
                {picked.specificDate ? 'Delete this one-off slot' : 'Delete entire weekly series'}
              </button>
              <button onClick={() => setPicked(null)} style={ghost()}>Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateModal({ creating, onClose, onSubmit, kinds = DEFAULT_KINDS }) {
  const dom = Number(creating.date.split('-')[2]);
  const [start, setStart] = useState(hhmm(creating.startMin));
  const [dur, setDur] = useState(String(creating.durMin));
  const [capacity, setCapacity] = useState('1');
  const [subject, setSubject] = useState('');
  const [recurrence, setRecurrence] = useState('weekly');
  const [diagnostic, setDiagnostic] = useState(false);
  // Which kind of session this slot is for. A family's credit only books the
  // kind it was bought as, so this decides which token the slot takes. With
  // one kind on offer there is nothing to choose and it is simply that kind.
  const [sessionType, setSessionType] = useState(kinds[0]?.type || null);
  const [busy, setBusy] = useState(false);

  const kind = kinds.find((k) => k.type === sessionType) || kinds[0] || null;
  const isPrivateKind = kind?.type === 'private';
  // A paid slot with no kind would take no family's credit — refuse to open one.
  // A free diagnostic slot charges nothing, so it is fine without.
  const canAdd = diagnostic || !!kind;

  const options = [
    ['weekly', `Weekly, every ${DOW[creating.dow]}`],
    ['weekday', 'Every weekday (Mon–Fri)'],
    ['daily', 'Every day'],
    ['monthly', `Monthly, on the ${ordinal(dom)}`],
    ['oneoff', 'Just this date (one-off)'],
  ];

  async function go() {
    setBusy(true);
    try {
      await onSubmit({
        recurrence,
        dayOfWeek: creating.dow,
        dayOfMonth: recurrence === 'monthly' ? dom : null,
        specificDate: recurrence === 'oneoff' ? creating.date : null,
        startMinute: fromHHMM(start),
        durationMinutes: Math.max(SNAP, Number(dur) || DEFAULT_DUR),
        // One student is one seat: a private slot is one seat whatever the box says.
        capacity: isPrivateKind ? 1 : Math.max(1, Number(capacity) || 1),
        kind: diagnostic ? 'diagnostic' : 'session',
        sessionType: kind?.type || null,
        subject,
      });
    } finally { setBusy(false); }
  }

  return (
    <div style={overlay()} onClick={onClose}>
      <div style={modal()} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: BROWN, margin: '0 0 4px' }}>New availability</h3>
        <div style={{ color: '#9b8b77', marginBottom: 14 }}>
          {new Date(creating.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={fld()}>Start<input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inp()} /></label>
          <label style={fld()}>Minutes<input type="number" min={SNAP} step={SNAP} value={dur} onChange={(e) => setDur(e.target.value)} style={{ ...inp(), width: 84 }} /></label>
          <label style={fld()}>Seats<input type="number" min="1" value={isPrivateKind ? '1' : capacity} disabled={isPrivateKind} title={isPrivateKind ? 'A private slot is one student' : undefined} onChange={(e) => setCapacity(e.target.value)} style={{ ...inp(), width: 72, opacity: isPrivateKind ? 0.6 : 1 }} /></label>
          <label style={fld()}>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="optional" style={inp()} /></label>
        </div>
        <label style={{ ...fld(), marginBottom: 14 }}>
          Repeats
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} style={{ ...inp(), minWidth: 240 }}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {/* The kind comes from the packages the tutor sells, so the slot can only
            open as something a family can hold a credit for. */}
        {!diagnostic && kinds.length > 1 ? (
          <div style={{ ...fld(), marginBottom: 14 }}>
            Session kind
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {kinds.map((k) => {
                const on = k.type === kind?.type;
                return (
                  <button
                    key={k.type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSessionType(k.type)}
                    style={{
                      ...ghost(),
                      padding: '7px 12px',
                      background: on ? ACCENT : '#faf8f5',
                      borderColor: on ? ACCENT : '#ece5db',
                      color: on ? '#fff' : BROWN,
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
            {kind?.hint ? <span style={{ fontSize: '0.78rem', color: '#9b8b77', fontWeight: 400 }}>{kind.hint} Books with a {kind.label.toLowerCase()} session token.</span> : null}
          </div>
        ) : null}
        {!diagnostic && kinds.length === 1 ? (
          <div style={{ fontSize: '0.82rem', color: '#9b8b77', marginBottom: 14 }}>
            Opens as <strong style={{ color: BROWN }}>{kind.label}</strong> — the only kind you sell packages for, so that is the token it takes.
          </div>
        ) : null}
        {!diagnostic && kinds.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: '#b3423a', background: '#fdf1ef', border: '1.5px solid #f3c9c3', borderRadius: 9, padding: '10px 12px', marginBottom: 14 }}>
            You have no packages priced yet, so a paid slot here would take nobody&rsquo;s session token. Set a package on your Rates page first, or open this as a free diagnostic slot.
          </div>
        ) : null}
        <label
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14,
            padding: '10px 12px', borderRadius: 9,
            background: diagnostic ? '#eef7ea' : '#faf8f5',
            border: `1.5px solid ${diagnostic ? GREEN : '#ece5db'}`, cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={diagnostic} onChange={(e) => setDiagnostic(e.target.checked)} style={{ marginTop: 3 }} />
          <span style={{ fontSize: '0.82rem', color: BROWN }}>
            <strong>Free diagnostic slot</strong>: bookable from the public /diagnostic page without an
            account, and never charges a session credit. Kept off the paid schedule.
          </span>
        </label>
        <div style={{ display: 'grid', gap: 8 }}>
          <button onClick={go} disabled={busy || !canAdd} style={{ ...btn(), opacity: canAdd ? 1 : 0.5 }}>{busy ? 'Adding…' : 'Add availability'}</button>
          <button onClick={onClose} disabled={busy} style={{ ...ghost(), border: 'none', color: '#9b8b77' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const navBtn = () => ({ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e6ddd2', background: '#fff', color: BROWN, fontWeight: 600, cursor: 'pointer' });
const btn = () => ({ padding: '10px 16px', borderRadius: 9, border: 'none', background: ACCENT, color: '#fff', fontWeight: 700, cursor: 'pointer' });
const dangerBtn = () => ({ padding: '10px 16px', borderRadius: 9, border: '1.5px solid #e0b4a0', background: '#fff', color: '#b5654a', fontWeight: 700, cursor: 'pointer' });
const ghost = () => ({ padding: '10px 16px', borderRadius: 9, border: '1.5px solid #e6ddd2', background: '#fff', color: BROWN, cursor: 'pointer' });
const inp = () => ({ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e6ddd2', fontSize: '0.92rem' });
const fld = () => ({ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', color: '#9b8b77', fontWeight: 600 });
const overlay = () => ({ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 });
const modal = () => ({ background: '#fff', borderRadius: 16, padding: '1.6rem', width: '100%', maxWidth: 460, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' });
