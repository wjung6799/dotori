'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import LocalTime from '../../LocalTime';
import PayPanel from '../../PayPanel';
import { expiryFor, formatUsd, lengthLabel, quoteFor, validityLabel } from '@/lib/pricing';
import { SESSION_TYPE_BLURB, sessionTypeLabel } from '@/lib/sessionTypes';

// Session credits (수업 크레딧) are PER INSTRUCTOR: every tutor sets their own
// rates, so a credit bought for one tutor books that tutor. That is why this page
// never adds the balances together into one number — they are not
// interchangeable, and a single "12 credits" figure would promise a family
// sessions they cannot actually book.
//
// They are also per KIND. Semi-private and private are separate products at
// separate rates, so a credit bought for one cannot book the other: a balance is
// a tutor AND a kind, and buying asks who first, then which kind, then which
// package — because a package only exists inside one kind's price list.
//
// A credit whose kind is null was granted before that distinction existed and
// still books either kind. That is a promise the school already made, not a hole
// in the data, so it is always spelled out rather than left blank.
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

// The kind a balance or a grant is for, in words. The API already names it, so
// this only has to hold the line on null: null is "either kind", and rendering
// it as blank or as an error would tell a family a credit they hold is broken.
function kindLabel(row) {
  if (row?.sessionTypeLabel) return row.sessionTypeLabel;
  return row?.sessionType ? sessionTypeLabel(row.sessionType) : 'Any session type';
}

export default function CreditsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tutorId, setTutorId] = useState(''); // '' = nobody picked yet
  const [sessionType, setSessionType] = useState(''); // '' = no kind picked yet
  const [packId, setPackId] = useState('');
  // 'ok' | 'pending' | 'attention' — what the return from Stripe actually said.
  const [returnStatus, setReturnStatus] = useState('');
  // ACH is the default because it is the fee-free option; picking the cheaper
  // way to pay should never be the extra step.
  const [method, setMethod] = useState('ach');

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
    const q = new URLSearchParams(window.location.search);
    if (q.get('paid') !== '1') return undefined;
    const rs = q.get('redirect_status');
    setReturnStatus(!rs || rs === 'succeeded' ? 'ok' : rs === 'processing' ? 'pending' : 'attention');
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [load]);

  const loading = !data && !error;
  const balances = data?.balances || [];
  const anyTutorRemaining = data?.anyTutorRemaining || 0;
  // Credits usable with anybody, split by kind — because "usable with anybody"
  // was never a statement about the kind, and a semi-private credit still only
  // books semi-private slots.
  const anyTutorBalances = data?.anyTutorBalances || [];
  const tutors = data?.tutors || [];
  const grants = data?.grants || [];
  const expiredSessions = data?.expiredSessions || 0;

  const tutor = tutors.find((t) => t.id === tutorId) || null;

  // Only the kinds this instructor has actually priced: showing "Private" for
  // someone who never set a private rate would quote them the group price.
  const kinds = tutor?.sessionTypes || [];
  // Derived, not stored, for two reasons: an instructor who sells one kind never
  // has to click the only option there is, and switching instructors cannot
  // leave a kind selected that the new one does not sell.
  const kind = kinds.find((k) => k.type === sessionType) || (kinds.length === 1 ? kinds[0] : null);
  const showKindPicker = kinds.length > 1;
  // Packages live inside one kind's price list; there is no combined list.
  const packs = kind?.packs || [];
  const pack = packs.find((p) => p.id === packId) || null;

  // The same quote the server recomputes at intent time — one function, same
  // inputs, so the button can never promise a figure the route will not charge.
  const quote = pack ? quoteFor(pack.amountCents, method, pack.onlineFeeCents) : null;
  const packTotal = quote ? quote.totalCents : 0;
  // The window starts when the payment clears, i.e. today — so this is quoted
  // from the current clock rather than frozen at mount. null months = no expiry,
  // and then there is no date to promise and the sentence is dropped entirely.
  const packExpiry = pack ? expiryFor(pack.validMonths) : null;
  // Stripe refuses anything under 50 cents, so a mispriced pack must never get a
  // pay button — point at a human instead of a guaranteed failure.
  const payable = pack && packTotal >= 50;

  // A tutor's packs are their own list; switching instructor invalidates the
  // chosen kind and pack outright rather than carrying stale ids across price
  // lists.
  function pickTutor(id) {
    setTutorId((prev) => (prev === id ? '' : id));
    setSessionType('');
    setPackId('');
  }

  // The same reasoning one level down: a pack id belongs to one kind's list, so
  // changing kind cannot keep the selection.
  function pickKind(type) {
    setSessionType((prev) => (prev === type ? '' : type));
    setPackId('');
  }

  async function createIntent() {
    const res = await fetch('/api/family/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorId: tutor.id, packId: pack.id, method }),
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

      {returnStatus === 'ok' ? (
        <div className="notice ok">
          <strong>Payment went through — thank you.</strong> Card payments confirm within a few
          seconds and your credits appear right away. If the balance below has not moved yet, give
          it a moment — this page checks again on its own.
        </div>
      ) : null}
      {returnStatus === 'pending' ? (
        <div className="notice info">
          <strong>Your bank transfer is on its way.</strong> It takes 3–5 business days to clear,
          and the sessions land in your balance the moment it does — we email your receipt then. If
          it cannot be completed, we email you that too, and nothing is charged.
        </div>
      ) : null}
      {returnStatus === 'attention' ? (
        <div className="notice warn">
          <strong>That payment did not finish.</strong> If you chose to verify your bank account
          with micro-deposits, follow the instructions Stripe emailed you and the purchase completes
          from there. Otherwise nothing was charged — you can simply try again.
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

      {/* ── Balances, one per instructor and kind ────────────────────────── */}
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
            {/* One row per instructor AND kind: they are not interchangeable,
                and keying on the tutor alone would collide the moment a family
                holds both kinds with the same instructor. */}
            {balances.map((b) => (
              <div className="stat" key={b.tutorId + '|' + (b.sessionType || 'any')}>
                <div className="label">
                  {kindLabel(b)} with {b.tutorName}
                </div>
                <div className="value">{b.remaining}</div>
                <div className="hint">
                  session{plural(b.remaining)} ·{' '}
                  {b.sessionType
                    ? `books ${kindLabel(b).toLowerCase()} slots only`
                    : 'books either kind'}
                </div>
              </div>
            ))}

            {/* Same rule one column over: a credit that works with anybody
                still only books its own kind, so each kind gets its own row
                rather than one figure that books less than it says. */}
            {anyTutorBalances.length > 0
              ? anyTutorBalances.map((b) => (
                  <div className="stat" key={'any|' + (b.sessionType || 'any')}>
                    {/* The untyped row keeps its old wording: "Any session type
                        with any instructor" says the same thing twice. */}
                    <div className="label">
                      {b.sessionType ? `${kindLabel(b)} with any instructor` : 'Any instructor'}
                    </div>
                    <div className="value">{b.remaining}</div>
                    <div className="hint">
                      session{plural(b.remaining)} ·{' '}
                      {b.sessionType
                        ? `books ${kindLabel(b).toLowerCase()} slots with anybody`
                        : 'books either kind, with anybody'}
                    </div>
                  </div>
                ))
              : anyTutorRemaining > 0 ? (
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
            ) : kinds.length === 0 ? (
              <div className="empty">
                <span className="ico">🎟</span>
                <p>
                  {tutor.name} has no packages priced yet.{' '}
                  <Link href="/contact">Contact the school</Link> and we will sort it out.
                </p>
              </div>
            ) : (
              <>
                {/* Step 2 — which kind. Semi-private and private are separate
                    products at separate rates, so this has to be answered before
                    any price list exists. Shown only when it is a real choice:
                    an instructor who sells one kind has it chosen already. */}
                {showKindPicker ? (
                  <>
                    <p className="flabel" style={{ marginTop: '1.5rem' }}>
                      2 · Choose a session type with {tutor.name}
                    </p>
                    <div className="grid grid-tight">
                      {kinds.map((k) => {
                        const chosen = k.type === kind?.type;
                        return (
                          <button
                            key={k.type}
                            type="button"
                            className="card"
                            aria-pressed={chosen}
                            onClick={() => pickKind(k.type)}
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
                              {k.label}
                            </span>
                            <span className="muted small">{SESSION_TYPE_BLURB[k.type] || ''}</span>
                            <span
                              className="small strong"
                              style={{ display: 'block', marginTop: '0.4rem' }}
                            >
                              {chosen ? '✓ Selected' : 'See these packages'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {!kind ? (
                  <p className="muted small" style={{ margin: '1rem 0 0' }}>
                    Pick a session type to see {tutor.name}&rsquo;s packages.
                  </p>
                ) : (
                  <>
                    {/* Then the packages, at this instructor's prices for this
                        kind. Numbered 2 when the kind was never asked about, so
                        the steps still read 1, 2, 3 either way. */}
                    <p className="flabel" style={{ marginTop: '1.5rem' }}>
                      {showKindPicker ? '3' : '2'} · Choose a {kind.label.toLowerCase()} package
                      with {tutor.name}
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

                    {/* Pay. Exactly one PayPanel is ever mounted, and the
                        instructor, the session type and the package are all in its
                        key, so changing any of them rebuilds the card form against
                        the right amount. */}
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

                        {/* Method picker: bank transfer at face value, card with
                            its processing fee. One line each, totals up front. */}
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                          {[
                            ['ach', 'Bank transfer', quoteFor(pack.amountCents, 'ach', pack.onlineFeeCents).totalCents],
                            ['card', 'Card', quoteFor(pack.amountCents, 'card', pack.onlineFeeCents).totalCents],
                          ].map(([m, mLabel, mTotal]) => (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={method === m}
                              onClick={() => setMethod(m)}
                              style={{
                                font: 'inherit',
                                cursor: 'pointer',
                                border: '1px solid ' + (method === m ? 'var(--brown-mid)' : 'var(--line)'),
                                borderWidth: method === m ? 2 : 1,
                                background: method === m ? 'var(--surface-2)' : 'transparent',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.5rem 0.9rem',
                              }}
                            >
                              <span className="strong">{mLabel}</span>{' '}
                              <span className="muted small">{formatUsd(mTotal)}</span>
                            </button>
                          ))}
                        </div>

                        {/* Only shown when a fee actually moves the number — never a
                            $0 row, so the bank-transfer view stays a single figure. */}
                        {quote.adjustmentCents ? (
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
                              <span className="main muted small">{quote.adjustmentLabel}</span>
                              <span className="small">{formatUsd(quote.adjustmentCents)}</span>
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
                            key={tutor.id + ':' + kind.type + ':' + pack.id + ':' + method}
                            amountCents={packTotal}
                            methods={method === 'ach' ? ['us_bank_account'] : ['card']}
                            createIntent={createIntent}
                            returnUrl="/dashboard/credits?paid=1"
                            label={'Pay ' + formatUsd(packTotal)}
                          />
                        ) : (
                          <div className="notice info" style={{ marginBottom: 0 }}>
                            This package is not set up for online payment yet.{' '}
                            <Link href="/contact">Contact the school</Link> and we will add the credits
                            for you.
                          </div>
                        )}
                      </div>
                    ) : packs.length > 0 ? (
                      <p className="muted small" style={{ margin: '1rem 0 0' }}>
                        Pick a package above to pay online.
                      </p>
                    ) : null}
                  </>
                )}
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
                  <th>Type</th>
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
                    {/* A grant from before kinds existed books either one, so
                        it says so here rather than showing an empty cell. */}
                    <td>{kindLabel(g)}</td>
                    <td>{g.note || 'Session credits'}</td>
                    <td className="nowrap">
                      {g.pending
                        ? `${g.totalSessions} on the way`
                        : `${g.remainingSessions} of ${g.totalSessions} left`}
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
                      {g.pending ? (
                        <span className="pill info">Bank transfer clearing</span>
                      ) : g.paid ? (
                        <span className="pill ok">Paid online</span>
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
