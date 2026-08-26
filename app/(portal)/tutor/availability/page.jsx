'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import AvailabilityCalendar from '@/components/AvailabilityCalendar';
import LocalTime from '../../LocalTime';
import {
  PRIVATE,
  SEMI_PRIVATE,
  SESSION_TYPES,
  SESSION_TYPE_BLURB,
  inferSlotType,
  sessionTypeLabel,
} from '@/lib/sessionTypes';
import { DOW_LABELS, minuteLabel, recurrenceLabel } from '@/lib/slots';

// When you teach: the weekly grid, and the one-off sessions layered on top of
// it. Granting session tokens used to share this page and now lives at
// /tutor/credits, because a family's balance has nothing to do with your
// timetable.
//
// Every /api/tutor/* route resolves the instructor from the session, so nothing
// on this page ever sends an instructor id.

// Family display name, always with the student name(s) attached: "Parent (Student)".
// A family row is the only safe thing to show — never the raw Mongo id.
const famName = (f) => {
  if (!f) return 'Family';
  const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
  const kids = (f.students || []).map((s) => s.name).filter(Boolean).join(', ');
  return kids ? `${base} (${kids})` : base;
};

// The seat count AvailabilityCalendar's create dialog opens with. The kind
// picker below is defaulted from it through inferSlotType, so the form starts on
// whatever the server would have inferred for a slot sent without a kind — one
// seat has always meant 1:1 — and the existing flow keeps saving what it saved.
const NEW_SLOT_SEATS = 1;

// How a schedule row reads in a list: "Every Tue", "Mon-Fri", "Sat, Sep 14".
// The recurrence is derived the same way lib/slots does it, and a row missing
// the day its recurrence needs falls back to the bare word rather than printing
// "undefined" at a tutor.
function whenLabel(s) {
  const rec = s.recurrence || (s.specificDate ? 'oneoff' : 'weekly');
  if (rec === 'oneoff') {
    if (!s.specificDate) return 'One-off';
    // A specificDate is a plain calendar date in the site timezone, not an
    // instant, so it is read as a date — LocalTime is for real timestamps.
    return new Date(`${s.specificDate}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  if (rec === 'weekly') {
    const d = DOW_LABELS[s.dayOfWeek];
    return d ? `Every ${d}` : 'Weekly';
  }
  if (rec === 'monthly') return s.dayOfMonth ? `Monthly, day ${s.dayOfMonth}` : 'Monthly';
  if (rec === 'weekday') return 'Mon–Fri';
  if (rec === 'daily') return 'Every day';
  return recurrenceLabel(s);
}

// Start and end, from the two numbers a schedule actually stores.
// The end is wrapped into the day before it is labelled: the grid lets a slot be
// dragged all the way down to midnight, and minuteLabel reads 1440 as hour 24,
// which prints "12:00 PM". An 11pm slot would then read "11:00 PM - 12:00 PM"
// and look like a thirteen-hour booking.
function timeLabel(s) {
  const start = Number(s.startMinute);
  if (!Number.isFinite(start)) return '—';
  const mins = Number(s.durationMinutes) || 60;
  return `${minuteLabel(start)} – ${minuteLabel((start + mins) % 1440)}`;
}

export default function TutorAvailabilityPage() {
  const [data, setData] = useState(null); // { tutor, schedules, exceptions }
  const [loadError, setLoadError] = useState('');
  const [slotError, setSlotError] = useState('');
  // Semi-private or private. Held here rather than inside the calendar's drag
  // dialog: the calendar is shared with the admin page, and a tutor opening a
  // run of slots normally opens them all as the same kind, so this is set once
  // and every drag that follows inherits it.
  const [newSlotType, setNewSlotType] = useState(() =>
    inferSlotType({ capacity: NEW_SLOT_SEATS }),
  );

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/tutor/me', { cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      setData(await res.json());
      setLoadError('');
    } catch {
      setLoadError('We could not load your calendar just now. Please refresh the page.');
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // Availability writes, scoped to the signed-in tutor by the route itself.
  // The calendar closes its own modal as soon as the promise settles, so a
  // failure has to land somewhere the tutor can still see it — otherwise a
  // rejected slot just silently never appears on the grid.
  async function addSlot(payload) {
    setSlotError('');
    // The kind is chosen on this page, so it is merged into the body on the way
    // out. buildScheduleFields reads the field as `sessionType`; sending none
    // would leave the slot on the capacity guess that only exists to read rows
    // written before kinds did.
    //
    // Private means one family taking the whole slot, so its seat count is set
    // here rather than trusting whatever the dialog's Seats box was left on — a
    // "private" slot with four seats in it is not a private slot.
    const capacity =
      newSlotType === PRIVATE ? 1 : Math.max(1, Number(payload?.capacity) || 1);
    const res = await fetch('/api/tutor/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(payload || {}), sessionType: newSlotType, capacity }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSlotError(d.error || 'That availability could not be added.');
    }
    await loadMe();
  }

  async function cancelInstance(scheduleId, dateKey) {
    setSlotError('');
    const res = await fetch(`/api/tutor/schedules/${scheduleId}/cancel-instance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateKey }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSlotError(d.error || 'That date could not be removed.');
    }
    await loadMe();
  }

  async function deleteSeries(scheduleId) {
    setSlotError('');
    const res = await fetch(`/api/tutor/schedules/${scheduleId}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSlotError(d.error || 'That series could not be deleted.');
    }
    await loadMe();
  }

  // /api/tutor/me answers 200 with tutor:null when the login has no instructor
  // profile attached — the page still has a head and an explanation, rather
  // than a calendar with nothing in it and no reason given.
  const notLinked = !!data && data.tutor === null;

  // The grid hides deactivated rows, so the list beside it has to hide them too
  // — a slot the table swears you have open and the calendar has no block for
  // is worse than not listing it at all. Every row gets a kind: inferSlotType
  // reads a legacy row with no sessionType off its capacity, so "none" never
  // reaches the screen as a blank or an error.
  const openSlots = (data?.schedules || []).filter((s) => s && s.active !== false);
  const semiCount = openSlots.filter((s) => inferSlotType(s) === SEMI_PRIVATE).length;
  const privateCount = openSlots.length - semiCount;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My availability</h1>
          <p className="lede">
            {data?.tutor ? `${data.tutor.name} · ` : ''}
            Open up the times you teach, and top up a family&rsquo;s session balance.
          </p>
        </div>
      </div>

      {loadError ? <div className="notice err">{loadError}</div> : null}

      {notLinked ? (
        <div className="notice warn">
          <strong>Your account isn&rsquo;t linked to an instructor profile yet.</strong> Ask an admin
          to link you on the Booking Admin &rarr; Instructors tab — your calendar and your families
          appear here as soon as they do.
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-head">
              <h2>Your teaching week</h2>
            </div>

            {slotError ? <div className="notice err">{slotError}</div> : null}

            {/* A slot has to be opened as one kind or the other. A family who
                bought private credits can only spend them on a private slot, so
                until one is open they are holding a package they cannot book. */}
            <div className="field">
              <label htmlFor="new-slot-type">New slots open as</label>
              <select
                id="new-slot-type"
                className="input"
                style={{ width: 'auto' }}
                value={newSlotType}
                onChange={(e) => setNewSlotType(e.target.value)}
              >
                {SESSION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {sessionTypeLabel(t)}
                  </option>
                ))}
              </select>
              <div className="hint">
                {SESSION_TYPE_BLURB[newSlotType]}{' '}
                {newSlotType === PRIVATE
                  ? 'One student is one seat, so a private slot is saved with a seat count of 1 whatever the Seats box in the drag dialog is left on.'
                  : 'The Seats box in the drag dialog sets how many students can share it.'}
              </div>
            </div>

            {data ? (
              <AvailabilityCalendar
                schedules={data.schedules || []}
                exceptions={data.exceptions || []}
                onAddSlot={addSlot}
                onCancelInstance={cancelInstance}
                onDeleteSeries={deleteSeries}
              />
            ) : (
              // Skeleton, not null: the card keeps its place on the page while
              // the week loads instead of popping in underneath the heading.
              <div className="empty">
                <span className="ico">🗓</span>
                <p>{loadError ? 'Your calendar could not be loaded.' : 'Loading your calendar…'}</p>
              </div>
            )}
          </div>

          {/* What is already open, spelled out. The grid shows one week at a
              time and a coloured block has no room to say which kind it is, so
              a tutor cannot tell from it alone what they have out. */}
          <div className="card">
            <div className="card-head">
              <h2>Slots you have open</h2>
            </div>

            {data ? (
              openSlots.length ? (
                <>
                  <p className="muted small">
                    {semiCount} semi-private &middot; {privateCount} private
                  </p>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Time</th>
                          <th>Kind</th>
                          <th>Seats</th>
                          <th>Subject</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openSlots.map((s) => {
                          const type = inferSlotType(s);
                          return (
                            <tr key={s._id}>
                              <td>{whenLabel(s)}</td>
                              <td className="nowrap">{timeLabel(s)}</td>
                              <td>
                                <span className={`pill ${type === PRIVATE ? 'info' : 'mute'}`}>
                                  {sessionTypeLabel(type)}
                                </span>
                                {/* A diagnostic slot still has a kind, but it
                                    never charges a credit — worth saying beside
                                    one, or the row reads as billable time. */}
                                {s.kind === 'diagnostic' ? (
                                  <>
                                    {' '}
                                    <span className="pill ok">Free diagnostic</span>
                                  </>
                                ) : null}
                              </td>
                              <td className="num">{s.capacity ?? 1}</td>
                              <td>{s.subject || <span className="muted">&mdash;</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="empty">
                  <span className="ico">🗓</span>
                  <p>Nothing open yet. Drag down a day on the grid above to add your first slot.</p>
                </div>
              )
            ) : (
              // Skeleton for the same reason the calendar has one: the card
              // holds its place instead of shoving the page around on load.
              <div className="empty">
                <span className="ico">🗓</span>
                <p>{loadError ? 'Your slots could not be loaded.' : 'Loading your slots…'}</p>
              </div>
            )}

            <p className="muted small mb0">
              Families buy session credits per kind, and a credit only books the kind it was bought
              for &mdash; so a kind you never open slots for is a package nobody can spend.{' '}
              <Link href="/tutor/rates">Check what you sell</Link>.
            </p>
          </div>

          {/* Granting session tokens moved to its own page — it is a money
              job, not a timetable one, and it was unfindable down here. */}
          <p className="muted small">
            Paid you offline? <Link href="/tutor/credits">Add session tokens</Link> so the family
            can book with them.
          </p>
        </>
      )}
    </>
  );
}
