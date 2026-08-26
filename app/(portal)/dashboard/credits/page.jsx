'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import LocalTime from '../../LocalTime';
import PayPanel from '../../PayPanel';
import { expiryFor, formatUsd, lengthLabel, validityLabel } from '@/lib/pricing';

// Session credits (수업 크레딧) are PER INSTRUCTOR: every tutor sets their own
// rates, so a credit bought for one tutor books that tutor. That is why this page
// never adds the balances together into one number — they are not
// interchangeable, and a single "12 credits" figure would promise a family
// sessions they cannot actually book.
//
// Booking already knows how to fall back to a credit that works with anybody, so
// nothing here has to explain that; families just see what they hold with whom.
//
// The credits themselves are granted by the Stripe webhook, never by this page,
// so a redirect back from checkout can land a beat before the balance moves.

const plural = (n) => (n === 1 ? '' : 's');

// A grant nearing its window gets a nudge a month out — long enough to still
// book the sessions, short enough that the warning means something.
const EXPIRING_SOON_DAYS = 30;

// null expiresAt means the grant NEVER lapses: everything granted before
// packages had a window carries null, and those credits must keep working
// forever. Unparseable data lands here too — a date we cannot read is not
// evidence that anything expired, so it gets no pill either.
function expiryState(iso) {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return null;
  const days = (at - Date.now()) / 86400000;
  if (days < 0) return 'expired';
  return days <= EXPIRING_SOON_DAYS ? 'soon' : 'ok';
}

// The flag beside an expiry date. Renders nothing while the window is still
// comfortably open, so the table stays quiet until a date actually matters.
function ExpiryPill({ iso }) {
  const state = expiryState(iso);
  if (state === 'expired') return <span className="pill err">Expired</span>;
  if (state === 'soon') return <span className="pill warn">Soon</span>;
  return null;
}

export default function CreditsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tutorId, setTutorId] = useState(''); // '' = nobody picked yet
  const [packId, setPackId] = useState('');
  const [justPaid, setJustPaid] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/family/credits', { cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      setData(await res.json());
      setError('');
    } catch {
      setError('We could not load your credits just now. Please refresh the page.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Coming back from Stripe. useSearchParams would need a Suspense boundary at
  // build time, and this only ever matters in the browser, so read the URL here.
  // The webhook usually lands within a couple of seconds: re-read once so the
  // page heals itself instead of asking the family to reload.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('paid') !== '1') return undefined;
    setJustPaid(true);
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [load]);

  const loading = !data && !error;
  const balances = data?.balances || [];
  const anyTutorRemaining = data?.anyTutorRemaining || 0;
  const tutors = data?.tutors || [];
  const grants = data?.grants || [];
  const expiredSessions = data?.expiredSessions || 0;

  const tutor = tutors.find((t) => t.id === tutorId) || null;
  const packs = tutor?.packs || [];
  const pack = packs.find((p) => p.id === packId) || null;

  const packTotal = pack ? pack.amountCents + (pack.onlineFeeCents || 0) : 0;
  // The window starts when the payment clears, i.e. today — so this is quoted
  // from the current clock rather than frozen at mount. null months = no expiry,
  // and then there is no date to promise and the sentence is dropped entirely.
  const packExpiry = pack ? expiryFor(pack.validMonths) : null;
  // Stripe refuses anything under 50 cents, so a mispriced pack must never get a
  // pay button — point at a human instead of a guaranteed failure.
  const payable = pack && packTotal >= 50;

  // A tutor's packs are their own list; switching instructor invalidates the
  // chosen pack outright rather than carrying a stale id across price lists.
  function pickTutor(id) {
    setTutorId((prev) => (prev === id ? '' : id));
    setPackId('');
  }

  async function createIntent() {
    const res = await fetch('/api/family/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorId: tutor.id, packId: pack.id }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.clientSecret) {
      // A 503 means card payments are not switched on; the route's message is
      // already plain English, so pass it through for PayPanel to show.
      throw new Error(payload.error || 'Could not start the payment. Please try again.');
    }
    return payload;
  }

  // Only a SUCCESSFUL load can say "you have none". When the fetch failed there
  // is no data, and rendering a confident 0 next to "we could not load your
  // credits" tells a family their sessions are gone when we simply do not know.
  const noCreditsAtAll = Boolean(data) && balances.length === 0 && anyTutorRemaining === 0;
  const balanceUnknown = !loading && !data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Session credits</h1>
          <p className="lede">
            What you hold with each instructor, and how to add more. (수업 크레딧)
          </p>
        </div>
      </div>

      {justPaid ? (
        <div className="notice ok">
          <strong>Payment went through — thank you.</strong> Your credits appear here as soon as
          Stripe confirms the charge, which usually takes a few seconds. If the balance below has
          not moved yet, give it a moment — this page checks again on its own.
        </div>
      ) : null}

      {error ? <div className="notice err">{error}</div> : null}

      {/* Lapsed sessions are deliberately stated as a plain number and kept out
          of the balances below, because booking will refuse them. The school
          extends a lapsed package once, so this points at a person, not a
          dead end. */}
      {expiredSessions > 0 ? (
        <div className="notice warn">
          <strong>
            {expiredSessions} session{plural(expiredSessions)} expired.
          </strong>{' '}
          {expiredSessions === 1 ? 'It is' : 'They are'} no longer bookable and{' '}
          {expiredSessions === 1 ? 'is' : 'are'} not counted in the balances below. If life got in
          the way, <Link href="/contact">contact the school</Link> — we extend a lapsed package
          once as a courtesy.
        </div>
      ) : null}

      {/* ── Balances, one per instructor ─────────────────────────────────── */}
      <div className="grid" style={{ marginBottom: '1.1rem' }}>
        {loading ? (
          <div className="stat">
            <div className="label">Credits remaining</div>
            <div className="value">—</div>
            <div className="hint">Loading your balance…</div>
          </div>
        ) : balanceUnknown ? (
          <div className="stat">
            <div className="label">Credits remaining</div>
            <div className="value">—</div>
            <div className="hint">We could not read your balance just now. Please refresh.</div>
          </div>
        ) : noCreditsAtAll ? (
          <div className="stat">
            <div className="label">Credits remaining</div>
            <div className="value">0</div>
            <div className="hint">
              Pick an instructor below to see their packages and add some.
            </div>
          </div>
        ) : (
          <>
            {balances.map((b) => (
              <div className="stat" key={b.tutorId}>
                <div className="label">{b.tutorName}</div>
                <div className="value">{b.remaining}</div>
                <div className="hint">
                  session{plural(b.remaining)} with {b.tutorName}
                </div>
              </div>
            ))}

            {anyTutorRemaining > 0 ? (
              <div className="stat">
                <div className="label">Any instructor</div>
                <div className="value">{anyTutorRemaining}</div>
                <div className="hint">
                  session{plural(anyTutorRemaining)} you can use with anybody
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* ── Buy more ─────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Add credits</h2>
          <Link className="link" href="/dashboard/booking">
            Book a session →
          </Link>
        </div>

        {loading ? (
          <div className="empty">
            <span className="ico">🎟</span>
            <p>Loading instructors…</p>
          </div>
        ) : tutors.length === 0 ? (
          <div className="empty">
            <span className="ico">🎟</span>
            <p>
              No instructors are taking new packages right now.{' '}
              <Link href="/contact">Contact the school</Link> and we will set you up.
            </p>
          </div>
        ) : (
          <>
            {/* Step 1 — who. Rates differ per instructor, so nothing can be
                priced until this is answered. */}
            <p className="flabel">1 · Choose an instructor (선생님)</p>
            <div className="grid grid-tight">
              {tutors.map((t) => {
                const chosen = t.id === tutorId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="card"
                    aria-pressed={chosen}
                    onClick={() => pickTutor(t.id)}
                    style={{
                      margin: 0,
                      font: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderWidth: chosen ? 2 : 1,
                      borderColor: chosen ? 'var(--brown-mid)' : 'var(--line)',
                    }}
                  >
                    <span className="strong" style={{ display: 'block' }}>
                      {t.name}
                    </span>
                    <span className="muted small">
                      {t.specialty || 'Tutoring'}
                    </span>
                    <span className="small strong" style={{ display: 'block', marginTop: '0.4rem' }}>
                      {chosen ? '✓ Selected' : 'See their rates'}
                    </span>
                  </button>
                );
              })}
            </div>

            {!tutor ? (
              <p className="muted small" style={{ margin: '1rem 0 0' }}>
                Pick an instructor to see their rates.
              </p>
            ) : (
              <>
                {/* Step 2 — which package, at this instructor's prices. */}
                <p className="flabel" style={{ marginTop: '1.5rem' }}>
                  2 · Choose a package with {tutor.name}
                </p>

                {packs.length === 0 ? (
                  <div className="empty">
                    <span className="ico">🎟</span>
                    <p>
                      {tutor.name} has no packages priced yet.{' '}
                      <Link href="/contact">Contact the school</Link> and we will sort it out.
                    </p>
                  </div>
                ) : (
                  <div className="grid">
                    {packs.map((p) => {
                      const chosen = p.id === packId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="card"
                          aria-pressed={chosen}
                          onClick={() => setPackId(chosen ? '' : p.id)}
                          style={{
                            margin: 0,
                            font: 'inherit',
                            textAlign: 'left',
                            cursor: 'pointer',
                            width: '100%',
                            borderWidth: chosen || p.highlight ? 2 : 1,
                            borderColor: chosen
                              ? 'var(--brown-mid)'
                              : p.highlight
                                ? 'var(--accent)'
                                : 'var(--line)',
                          }}
                        >
                          <div className="card-head" style={{ marginBottom: '0.5rem' }}>
                            <h2>{p.name}</h2>
                            {p.tag ? (
                              <span className={p.highlight ? 'pill warn' : 'pill mute'}>{p.tag}</span>
                            ) : null}
                          </div>

                          <div
                            className="strong"
                            style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}
                          >
                            {formatUsd(p.amountCents)}
                          </div>
                          <p className="muted small" style={{ margin: '0.15rem 0 0.75rem' }}>
                            ${p.ratePerHour}/hour · {p.sessions} session{plural(p.sessions)}
                            {/* Length matters the moment an instructor sells two
                                of them: "12 sessions" alone cannot tell a
                                60-minute quarter from a 90-minute one. */}
                            {p.hoursPerSession ? ` × ${lengthLabel(p.hoursPerSession)}` : ''}
                          </p>

                          <ul
                            className="small muted"
                            style={{
                              listStyle: 'none',
                              margin: 0,
                              padding: 0,
                              display: 'grid',
                              gap: '0.3rem',
                            }}
                          >
                            {(p.lines || []).map((line) => (
                              <li key={line}>· {line}</li>
                            ))}
                          </ul>

                          {/* A family weighing a 10-pack against a 40-pack is
                              really weighing how long they have to use it, so
                              the window belongs beside the price. */}
                          <p className="muted small" style={{ margin: '0.6rem 0 0' }}>
                            {validityLabel(p.validMonths)}
                          </p>

                          <p className="small strong" style={{ margin: '0.85rem 0 0' }}>
                            {chosen ? '✓ Selected' : 'Choose this package'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {tutor.usesDefaultRates && packs.length > 0 ? (
                  <p className="muted small" style={{ margin: '0.8rem 0 0' }}>
                    These are the school&rsquo;s standard rates.
                  </p>
                ) : null}

                {/* Step 3 — pay. Exactly one PayPanel is ever mounted, and both
                    the instructor and the package are in its key so a change
                    rebuilds the card form against the right amount. */}
                {pack ? (
                  <div style={{ marginTop: '1.35rem' }}>
                    <p className="strong" style={{ margin: '0 0 0.15rem' }}>
                      {pack.name} with {tutor.name}
                    </p>
                    <p className="muted small" style={{ margin: '0 0 0.7rem' }}>
                      {pack.sessions} session{plural(pack.sessions)} with {tutor.name}, added to your
                      balance once the payment clears.
                      {packExpiry ? (
                        <>
                          {' '}
                          These sessions would need to be used by{' '}
                          <LocalTime iso={packExpiry.toISOString()} format="date" />.
                        </>
                      ) : null}
                    </p>

                    {/* Only shown when a fee actually moves the number — never a
                        $0 row. Fees are off today, so this normally stays hidden. */}
                    {pack.onlineFeeCents ? (
                      <div
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--line-soft)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.85rem 1.05rem',
                          marginBottom: '0.9rem',
                        }}
                      >
                        <div className="row" style={{ background: 'none', border: 0, padding: 0 }}>
                          <span className="main muted small">{pack.name}</span>
                          <span className="small">{formatUsd(pack.amountCents)}</span>
                        </div>
                        <div
                          className="row"
                          style={{ background: 'none', border: 0, padding: '0.2rem 0 0' }}
                        >
                          <span className="main muted small">Online payment fee</span>
                          <span className="small">{formatUsd(pack.onlineFeeCents)}</span>
                        </div>
                        <div
                          className="row"
                          style={{
                            background: 'none',
                            border: 0,
                            borderTop: '1px solid var(--line)',
                            marginTop: '0.45rem',
                            padding: '0.45rem 0 0',
                          }}
                        >
                          <span className="main strong">Total by card</span>
                          <span className="strong" style={{ fontSize: '1.15rem' }}>
                            {formatUsd(packTotal)}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {payable ? (
                      <PayPanel
                        key={tutor.id + ':' + pack.id}
                        amountCents={packTotal}
                        methods={['card']}
                        createIntent={createIntent}
                        returnUrl="/dashboard/credits?paid=1"
                        label={'Pay ' + formatUsd(packTotal)}
                      />
                    ) : (
                      <div className="notice info" style={{ marginBottom: 0 }}>
                        This package is not set up for card payment yet.{' '}
                        <Link href="/contact">Contact the school</Link> and we will add the credits
                        for you.
                      </div>
                    )}
                  </div>
                ) : packs.length > 0 ? (
                  <p className="muted small" style={{ margin: '1rem 0 0' }}>
                    Pick a package above to pay by card.
                  </p>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      {/* ── History ──────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Credit history</h2>
        </div>

        {loading ? (
          <div className="empty">
            <span className="ico">🗂</span>
            <p>Loading your history…</p>
          </div>
        ) : grants.length === 0 ? (
          <div className="empty">
            <span className="ico">🗂</span>
            <p>No credits yet. Anything you buy or we add for you shows up here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Instructor</th>
                  <th>What</th>
                  <th>Sessions</th>
                  <th>Expires</th>
                  <th>How paid</th>
                  {/* table.data styles td.num only, so the header is aligned here. */}
                  <th className="num" style={{ textAlign: 'right' }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id}>
                    <td className="nowrap">
                      <LocalTime iso={g.createdAt} format="date" />
                    </td>
                    <td>{g.tutorName || 'Any instructor'}</td>
                    <td>{g.note || 'Session credits'}</td>
                    <td className="nowrap">
                      {g.remainingSessions} of {g.totalSessions} left
                    </td>
                    <td className="nowrap">
                      {g.expiresAt ? (
                        <>
                          <LocalTime iso={g.expiresAt} format="date" />{' '}
                          <ExpiryPill iso={g.expiresAt} />
                          {/* Says why the date is later than the package sold:
                              the one courtesy extension has been used. */}
                          {g.extendedAt ? <div className="muted small">extended</div> : null}
                        </>
                      ) : (
                        /* No expiry — never render this as lapsed. */
                        '—'
                      )}
                    </td>
                    <td>
                      {g.paid ? (
                        <span className="pill ok">Card</span>
                      ) : (
                        <span className="pill mute">Recorded by the school</span>
                      )}
                    </td>
                    <td className="num">
                      {g.amountPaidCents ? formatUsd(g.amountPaidCents) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="muted small">
        Prefer to pay by Zelle? That still works — <Link href="/contact">contact the school</Link>,
        and we will add the credits to your balance here.
      </p>
    </>
  );
}
