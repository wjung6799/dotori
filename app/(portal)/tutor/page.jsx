'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { formatUsd } from '@/lib/pricing';
import LocalTime from '../LocalTime';

// The instructor's landing page. Everything here is a read: one number per
// question an instructor actually asks on arriving ("what's on today", "am I
// booked this week", "what have families already paid me for"), each one a link
// into the page that can change it. Nothing on this screen writes.
//
// Client-side because middleware.js already gates /tutor/* and every
// /api/tutor/* route resolves the instructor from the session — no id travels
// with the request, so there is nothing here a server render would protect.

const DAY_MS = 24 * 60 * 60 * 1000;

// Fetch that never throws: one dead endpoint should degrade a single card, not
// blank the whole overview.
async function loadJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    // 403 is the "your login isn't linked to an instructor profile" case, which
    // /api/tutor/me reports as tutor: null. Let the caller decide.
    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export default function TutorOverviewPage() {
  const [state, setState] = useState({ loading: true, me: null, bookings: [], rates: null, failed: false });

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadJson('/api/tutor/me'),
      loadJson('/api/tutor/bookings'),
      loadJson('/api/tutor/rates'),
    ]).then(([me, bookings, rates]) => {
      if (!alive) return;
      setState({
        loading: false,
        me: me.ok ? me.data : null,
        bookings: bookings.ok ? bookings.data?.bookings || [] : [],
        rates: rates.ok ? rates.data : null,
        // Only the profile call failing is worth shouting about; the other two
        // have their own empty states.
        failed: !me.ok,
      });
    });
    return () => { alive = false; };
  }, []);

  const { loading, me, bookings, rates, failed } = state;

  // A stable skeleton rather than null: the sidebar is already on screen, so a
  // blank content column reads as a broken page.
  if (loading) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Welcome back</h1>
            <p className="lede">Loading your instructor overview…</p>
          </div>
        </div>
        <section className="grid">
          {['Sessions left today', 'This week', 'Availability slots', 'Credits outstanding'].map((label) => (
            <div className="stat" key={label}>
              <div className="label">{label}</div>
              <div className="value">—</div>
              <div className="hint">&nbsp;</div>
            </div>
          ))}
        </section>
      </>
    );
  }

  if (failed) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Instructor overview</h1>
          </div>
        </div>
        <div className="notice err">
          We couldn&rsquo;t load your instructor overview just now. Refresh the page, and tell the
          office if it keeps happening.
        </div>
      </>
    );
  }

  const tutor = me?.tutor || null;

  // No linked profile means every query below is scoped to nobody: the numbers
  // would all be zero and read as "you have no work", which is a lie. Say what
  // is actually wrong instead.
  if (!tutor) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Instructor overview</h1>
          </div>
        </div>
        <div className="notice warn">
          Your login isn&rsquo;t linked to an instructor profile yet, so there&rsquo;s nothing to
          show here. Ask an admin to link your account and this page will fill in.
        </div>
      </>
    );
  }

  const firstName = (tutor.name || '').trim().split(/\s+/)[0] || 'there';
  const schedules = me?.schedules || [];

  const now = new Date();
  const todayKey = now.toDateString();
  const weekEnd = now.getTime() + 7 * DAY_MS;

  // The bookings route already sorts upcoming ascending and filters out the
  // past, so position 0 is genuinely the next session.
  const upcoming = bookings.filter((b) => b?.startAt);
  const todays = upcoming.filter((b) => new Date(b.startAt).toDateString() === todayKey);
  const thisWeek = upcoming.filter((b) => new Date(b.startAt).getTime() <= weekEnd);
  const nextToday = todays[0] || null;
  const nextFive = upcoming.slice(0, 5);

  const packs = rates?.packs || [];
  const usesDefaultRates = Boolean(rates?.usesDefaultRates);
  const outstanding = rates ? rates.outstandingCredits ?? 0 : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p className="lede">{tutor.specialty || 'Instructor at Dotori School'}</p>
        </div>
        <Link href="/tutor/bookings" className="btn btn-primary">Book a student</Link>
      </div>

      <section className="grid" style={{ marginBottom: '1.1rem' }}>
        <Link href="/tutor/bookings" className="stat" style={{ textDecoration: 'none' }}>
          <div className="label">Sessions left today</div>
          <div className="value">{todays.length}</div>
          <div className="hint">
            {nextToday ? (
              <>Next at <LocalTime iso={new Date(nextToday.startAt).toISOString()} /></>
            ) : (
              'Nothing left today'
            )}
          </div>
        </Link>

        <Link href="/tutor/bookings" className="stat" style={{ textDecoration: 'none' }}>
          <div className="label">This week</div>
          <div className="value">{thisWeek.length}</div>
          <div className="hint">Booked in the next 7 days</div>
        </Link>

        <Link href="/tutor/availability" className="stat" style={{ textDecoration: 'none' }}>
          <div className="label">Availability slots</div>
          <div className="value">{schedules.length}</div>
          <div className="hint">
            {schedules.length === 0 ? 'Add a time families can book' : 'Times you offer'}
          </div>
        </Link>

        <Link href="/tutor/rates" className="stat" style={{ textDecoration: 'none' }}>
          <div className="label">Credits outstanding</div>
          <div className="value">{outstanding === null ? '—' : outstanding}</div>
          <div className="hint">Sessions families have already paid you for</div>
        </Link>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Next sessions</h2>
          <Link href="/tutor/bookings" className="link">All bookings →</Link>
        </div>
        {nextFive.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">📅</span>
            <p>Nothing booked yet. Open a time on your availability page and families can claim it.</p>
          </div>
        ) : (
          <div className="stack">
            {nextFive.map((b) => (
              <div className="row" key={String(b._id)}>
                <span className="main">
                  <span className="strong">{b.studentName}</span>
                  <span className="meta">
                    {' · '}
                    <LocalTime iso={new Date(b.startAt).toISOString()} />
                  </span>
                </span>
                {/* A private booking takes the whole slot (two credits), so it is
                    worth flagging before the instructor expects a group. */}
                <span className={`pill ${b.isPrivate ? 'info' : 'mute'}`}>
                  {b.isPrivate ? 'Private' : 'Regular'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Your rates</h2>
          <Link href="/tutor/rates" className="link">Edit rates →</Link>
        </div>

        {usesDefaultRates ? (
          <div className="notice info">
            These are the school&rsquo;s default packages — you haven&rsquo;t set prices of your own
            yet.{' '}
            <Link href="/tutor/rates" className="btn btn-accent btn-sm" style={{ marginLeft: '0.35rem' }}>
              Set your own
            </Link>
          </div>
        ) : null}

        {packs.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">🏷</span>
            <p>No packages are quoted right now. Add one so families can buy sessions with you.</p>
          </div>
        ) : (
          <div className="stack">
            {packs.map((p) => (
              <div className="row" key={p.id}>
                <span className="main">
                  <span className="strong">{p.name}</span>
                  <span className="meta">
                    {' · '}
                    {p.sessions} session{p.sessions === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="strong nowrap">{formatUsd(p.amountCents)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
