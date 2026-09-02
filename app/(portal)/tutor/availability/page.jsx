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
  declaredSlotType,
  sessionTypeLabel,
} from '@/lib/sessionTypes';
import { sessionTypesForTutor } from '@/lib/pricing';
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
  // The kinds this tutor can open a slot as: exactly the ones they sell a
  // package for. A slot is a promise that some family's token fits it, and the
  // package is where that token is defined — so the drag dialog offers these
  // and nothing else. Yesol sells both; Won sells semi-private only.
  const kinds = data?.tutor
    ? sessionTypesForTutor(data.tutor).map((t) => ({
        type: t,
        label: sessionTypeLabel(t),
        hint: SESSION_TYPE_BLURB[t],
      }))
    : [];

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
    // The dialog picked the kind from `kinds`, so it is one this tutor sells.
    // A paid slot arriving without one would fall back to the server's seat-count
    // guess, and a guessed slot takes any token — the opposite of the point.
    const sessionType = payload?.sessionType || null;
    if (payload?.kind !== 'diagnostic' && !sessionType) {
      setSlotError('Pick which kind of session this slot is for. Price a package on your Rates page if none is offered.');
      return;
    }
    // One student is one seat: a private slot is saved with one seat whatever
    // the dialog's Seats box was left on.
    const capacity =
      sessionType === PRIVATE ? 1 : Math.max(1, Number(payload?.capacity) || 1);
    const res = await fetch('/api/tutor/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(payload || {}), sessionType, capacity }),
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

  // Stop offering a series from now on, keeping every session already booked
  // on it — the gentle sibling of deleteSeries (which cancels and refunds).
  async function stopSeries(scheduleId) {
    setSlotError('');
    const res = await fetch(`/api/tutor/schedules/${scheduleId}/stop`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSlotError(d.error || 'That series could not be stopped.');
    }
    await loadMe();
  }

  // Declare (or change) which kind a slot is. The row's select is the only way
  // in: a slot opened before slots had a kind is undeclared, and an undeclared
  // slot takes any token, so this is how a tutor makes an old row as strict as
  // a new one. Only the kind goes over the wire — nothing else on the row moves.
  async function setSlotKind(scheduleId, sessionType) {
    setSlotError('');
    const res = await fetch(`/api/tutor/schedules/${scheduleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionType }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSlotError(d.error || 'That slot could not be updated.');
    }
    await loadMe();
  }

  // /api/tutor/me answers 200 with tutor:null when the login has no instructor
  // profile attached — the page still has a head and an explanation, rather
  // than a calendar with nothing in it and no reason given.
  const notLinked = !!data && data.tutor === null;

  // The grid hides deactivated rows, so the list beside it has to hide them too
  // — a slot the table swears you have open and the calendar has no block for
  // is worse than not listing it at all. The kind is read with declaredSlotType,
  // not inferSlotType: a row the tutor never declared is counted and shown as
  // "not set", because a guess from its seat count would tell them a slot is
  // private when the server will in fact let any token book it.
  const openSlots = (data?.schedules || []).filter((s) => s && s.active !== false);
  const paidSlots = openSlots.filter((s) => s.kind !== 'diagnostic');
  const semiCount = paidSlots.filter((s) => declaredSlotType(s) === SEMI_PRIVATE).length;
  const privateCount = paidSlots.filter((s) => declaredSlotType(s) === PRIVATE).length;
  const unsetCount = paidSlots.length - semiCount - privateCount;
  // The kinds a row's select offers: what this tutor sells, or both if they
  // have priced nothing yet — a tutor with no packages still has to be able to
  // label an old slot, and the label is what the booking page shows a family.
  const kindOptions = kinds.length ? kinds.map((k) => k.type) : SESSION_TYPES;

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

            {/* Drag a column to open a slot. The dialog asks which kind it is,
                offering only the kinds this tutor sells a package for — a slot
                is a promise that some family's token fits it. */}
            <p className="muted small">
              Drag down a day to open a slot. It opens as one of the kinds you sell &mdash;{' '}
              {kinds.length
                ? kinds.map((k) => k.label).join(' or ')
                : 'none yet, so only free diagnostic slots can be opened'}
              {' '}&mdash; and takes that kind of session token.{' '}
              <Link href="/tutor/rates">Change what you sell</Link>.
            </p>

            {data ? (
              <AvailabilityCalendar
                schedules={data.schedules || []}
                exceptions={data.exceptions || []}
                kinds={kinds}
                onAddSlot={addSlot}
                onCancelInstance={cancelInstance}
                onDeleteSeries={deleteSeries}
                onStopSeries={stopSeries}
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
                    {unsetCount ? (
                      <>
                        {' '}&middot; {unsetCount} not set &mdash; a slot with no kind takes any
                        session token until you set one below.
                      </>
                    ) : null}
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
                          const type = declaredSlotType(s);
                          const isDiagnostic = s.kind === 'diagnostic';
                          // A declared kind stays in the list even if the tutor
                          // no longer sells it — otherwise the select would
                          // silently show the wrong kind as chosen.
                          const options =
                            type && !kindOptions.includes(type) ? [type, ...kindOptions] : kindOptions;
                          return (
                            <tr key={s._id}>
                              <td>{whenLabel(s)}</td>
                              <td className="nowrap">{timeLabel(s)}</td>
                              <td>
                                {/* A diagnostic slot charges nothing, so its
                                    kind is beside the point — it says so and
                                    gets no select. A paid slot shows the kind
                                    the tutor declared, or "Not set" when they
                                    never did: never the seat-count guess, which
                                    would call a slot private that the server
                                    will let any token book. */}
                                {isDiagnostic ? (
                                  <span className="pill ok">Free diagnostic</span>
                                ) : type ? (
                                  <span className={`pill ${type === PRIVATE ? 'info' : 'mute'}`}>
                                    {sessionTypeLabel(type)}
                                  </span>
                                ) : (
                                  <span className="pill warn">Not set</span>
                                )}
                                {!isDiagnostic ? (
                                  <>
                                    {' '}
                                    {/* .input is width:100%, so this needs a
                                        width, like the one on the Rates page. */}
                                    <select
                                      className="input"
                                      aria-label={
                                        type
                                          ? 'Change which kind of session this slot is'
                                          : 'Set which kind of session this slot is'
                                      }
                                      value={type || ''}
                                      onChange={(e) => {
                                        if (e.target.value) setSlotKind(s._id, e.target.value);
                                      }}
                                      style={{
                                        width: 'auto',
                                        display: 'inline-block',
                                        padding: '0.2rem 0.4rem',
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      {type ? null : <option value="">Set kind…</option>}
                                      {options.map((t) => (
                                        <option key={t} value={t}>
                                          {sessionTypeLabel(t)}
                                        </option>
                                      ))}
                                    </select>
                                    {type ? null : (
                                      <div className="muted small">
                                        Takes any session token until you set it.
                                      </div>
                                    )}
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
