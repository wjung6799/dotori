'use client';

import { useCallback, useEffect, useState } from 'react';

import AvailabilityCalendar from '@/components/AvailabilityCalendar';
import LocalTime from '../../LocalTime';

// When you teach, and who has sessions to spend on it. These were two separate
// tabs on the old marketing-site dashboard ("My Availability" and "Add
// Sessions"), but they are one job: opening the week up, then making sure the
// families you teach have the balance to book into it.
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

          {data ? (
            <SessionsCard />
          ) : (
            <div className="card">
              <div className="card-head">
                <h2>Add sessions</h2>
              </div>
              <div className="empty">
                <span className="ico">🎟</span>
                <p>{loadError ? 'Your families could not be loaded.' : 'Loading your families…'}</p>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// The old "Add Sessions" tab. Granting sessions is how a family who paid you
// offline (Zelle, cash) gets a balance they can book with; the grant is scoped
// to you, so it only ever buys time with you.
function SessionsCard() {
  const [families, setFamilies] = useState(null); // null while loading, [] when genuinely empty
  const [grants, setGrants] = useState(null); // null while loading, [] when genuinely empty
  const [userId, setUserId] = useState('');
  const [sessions, setSessions] = useState('1');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);

  const loadGrants = useCallback(async () => {
    try {
      const res = await fetch('/api/tutor/credits', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      setGrants(d.credits || []);
    } catch {
      setGrants([]);
    }
  }, []);

  useEffect(() => {
    fetch('/api/tutor/families', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setFamilies(d.families || []))
      .catch(() => setFamilies([]));
    loadGrants();
  }, [loadGrants]);

  async function grant(e) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/tutor/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessions: Number(sessions), note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: d.error || 'Failed.' });
      } else {
        setMsg({ ok: true, text: 'Sessions added.' });
        setNote('');
        loadGrants();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Remove this session grant?')) return;
    await fetch(`/api/tutor/credits/${id}`, { method: 'DELETE' });
    loadGrants();
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Add sessions</h2>
        </div>

        {/* A full-width select across a 1160px console column is unreadable, and
            portal.css has no width utility — hence the one inline cap. */}
        <form onSubmit={grant} style={{ maxWidth: 520 }}>
          <div className="field">
            <label htmlFor="grant-family">Family</label>
            <select
              id="grant-family"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            >
              <option value="">Select a family…</option>
              {(families || []).map((f) => (
                <option key={f._id} value={f._id}>
                  {famName(f)} ({f.email})
                </option>
              ))}
            </select>
            {families && families.length === 0 ? (
              <p className="hint">No families on the books yet.</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="grant-sessions">Sessions to add</label>
            <input
              id="grant-sessions"
              type="number"
              min="1"
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="grant-note">Note</label>
            <input
              id="grant-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid via Zelle"
            />
            <p className="hint">Shows on the family&rsquo;s credit history, so say how they paid.</p>
          </div>

          <button className="btn btn-accent" disabled={busy || !userId}>
            {busy ? 'Adding…' : 'Add sessions'}
          </button>

          {msg ? (
            <div className={msg.ok ? 'notice ok' : 'notice err'} style={{ margin: '1rem 0 0' }}>
              {msg.text}
            </div>
          ) : null}
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Sessions you&rsquo;ve granted</h2>
        </div>

        {grants === null ? (
          <div className="empty">
            <span className="ico">🎟</span>
            <p>Loading your grants…</p>
          </div>
        ) : grants.length === 0 ? (
          <div className="empty">
            <span className="ico">🎟</span>
            <p>No grants yet. Anything you add above shows up here.</p>
          </div>
        ) : (
          <div className="stack">
            {grants.map((g) => (
              <div className="row" key={g._id}>
                <div className="main">
                  <span className="strong">{famName(g.userId)}</span>{' '}
                  <span className={g.remainingSessions > 0 ? 'pill ok' : 'pill mute'}>
                    {g.remainingSessions} of {g.totalSessions} left
                  </span>
                  {g.createdAt || g.note ? (
                    <div className="meta">
                      {g.createdAt ? <LocalTime iso={g.createdAt} format="date" /> : null}
                      {g.createdAt && g.note ? ' · ' : null}
                      {g.note || null}
                    </div>
                  ) : null}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(g._id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
