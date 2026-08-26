'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import AvailabilityCalendar from '@/components/AvailabilityCalendar';
import LocalTime from '../../LocalTime';

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

export default function TutorAvailabilityPage() {
  const [data, setData] = useState(null); // { tutor, schedules, exceptions }
  const [loadError, setLoadError] = useState('');
  const [slotError, setSlotError] = useState('');

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
    const res = await fetch('/api/tutor/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
