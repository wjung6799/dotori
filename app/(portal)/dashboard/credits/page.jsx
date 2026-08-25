'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import LocalTime from '../../LocalTime';
import PayPanel from '../../PayPanel';
import { formatUsd } from '@/lib/pricing';

// Session credits: the balance, the packs a family can buy with a card, and the
// history of every grant — bought or recorded by the school. The credits
// themselves are granted by the Stripe webhook, never by this page, so a
// redirect back from checkout can arrive a beat before the balance moves.

export default function CreditsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
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

  // Coming back from Stripe: the webhook usually lands within a couple of
  // seconds, so re-read once instead of making the family reload by hand.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('paid') !== '1') return undefined;
    setJustPaid(true);
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [load]);

  const loading = !data && !error;
  const packs = data?.packs || [];
  const grants = data?.grants || [];
  const totalRemaining = data?.totalRemaining ?? 0;

  const selected = packs.find((p) => p.id === selectedId) || null;
  // Stripe rejects anything under 50 cents, so a mispriced pack must never get a
  // pay button — send the family to a human instead of a guaranteed failure.
  const selectedFee = selected?.onlineFeeCents || 0;
  const selectedTotal = (selected?.amountCents || 0) + selectedFee;
  const payable = selected && selectedTotal >= 50;

  const packName = (packId) => packs.find((p) => p.id === packId)?.name || '';

  async function createIntent() {
    const res = await fetch('/api/family/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId: selected.id }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.clientSecret) {
      throw new Error(payload.error || 'Could not start the payment. Please try again.');
    }
    return { clientSecret: payload.clientSecret };
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Session credits</h1>
          <p className="lede">Your balance, and how to add more. (수업 크레딧)</p>
        </div>
      </div>

      {justPaid ? (
        <div className="notice ok">
          <strong>Payment went through — thank you.</strong> Your credits appear here as soon as
          Stripe confirms the charge, which usually takes a few seconds. If the balance below has
          not moved yet, refresh the page in a moment.
        </div>
      ) : null}

      {error ? <div className="notice err">{error}</div> : null}

      <div className="stat" style={{ marginBottom: '1.1rem' }}>
        <div className="label">Credits remaining</div>
        <div className="value">{loading ? '—' : totalRemaining}</div>
        <div className="hint">
          1 credit books one small-group session; a private whole-slot booking spends 2.
        </div>
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
            <p>Loading packages…</p>
          </div>
        ) : packs.length === 0 ? (
          <div className="empty">
            <span className="ico">🎟</span>
            <p>
              No packages are on sale right now. <Link href="/contact">Contact the school</Link> and
              we will set you up.
            </p>
          </div>
        ) : (
          <>
            <div className="grid">
              {packs.map((pack) => {
                const isSelected = pack.id === selectedId;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    className="card"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(isSelected ? '' : pack.id)}
                    style={{
                      margin: 0,
                      font: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      borderWidth: pack.highlight || isSelected ? 2 : 1,
                      borderColor: isSelected
                        ? 'var(--brown-mid)'
                        : pack.highlight
                          ? 'var(--accent)'
                          : 'var(--line)',
                    }}
                  >
                    <div className="card-head" style={{ marginBottom: '0.5rem' }}>
                      <h2>{pack.name}</h2>
                      {pack.tag ? (
                        <span className={pack.highlight ? 'pill warn' : 'pill mute'}>{pack.tag}</span>
                      ) : null}
                    </div>

                    <div
                      className="strong"
                      style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}
                    >
                      {formatUsd(pack.amountCents)}
                    </div>
                    <p className="muted small" style={{ margin: '0.15rem 0 0.75rem' }}>
                      ${pack.ratePerHour}/hour · {pack.sessions} session
                      {pack.sessions === 1 ? '' : 's'}
                    </p>

                    <ul
                      className="small muted"
                      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem' }}
                    >
                      {(pack.lines || []).map((line) => (
                        <li key={line}>· {line}</li>
                      ))}
                    </ul>

                    <p className="small strong" style={{ margin: '0.85rem 0 0' }}>
                      {isSelected ? '✓ Selected' : 'Choose this package'}
                    </p>
                  </button>
                );
              })}
            </div>

            {selected ? (
              <div style={{ marginTop: '1.25rem' }}>
                <p className="strong" style={{ margin: '0 0 0.15rem' }}>
                  {selected.name}
                </p>
                <p className="muted small" style={{ margin: '0 0 0.7rem' }}>
                  {selected.sessions} session{selected.sessions === 1 ? '' : 's'} added to your
                  balance once the payment clears.
                </p>

                {/* Only worth showing when a fee moves the number; the package
                    card above already states the price. */}
                {selectedFee ? (
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
                    <span className="main muted small">{selected.name}</span>
                    <span className="small">{formatUsd(selected.amountCents)}</span>
                  </div>
                  {selectedFee ? (
                    <div className="row" style={{ background: 'none', border: 0, padding: '0.2rem 0 0' }}>
                      <span className="main muted small">Online payment fee</span>
                      <span className="small">{formatUsd(selectedFee)}</span>
                    </div>
                  ) : null}
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
                      {formatUsd(selectedTotal)}
                    </span>
                  </div>
                </div>
                ) : null}

                {payable ? (
                  <PayPanel
                    amountCents={selectedTotal}
                    methods={['card']}
                    createIntent={createIntent}
                    returnUrl="/dashboard/credits?paid=1"
                    label={'Pay ' + formatUsd(selectedTotal)}
                  />
                ) : (
                  <div className="notice info" style={{ marginBottom: 0 }}>
                    This package is not set up for card payment yet.{' '}
                    <Link href="/contact">Contact the school</Link> and we will add the credits for
                    you.
                  </div>
                )}
              </div>
            ) : (
              <p className="muted small" style={{ margin: '1rem 0 0' }}>
                Pick a package above to pay by card.
              </p>
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
                  <th>What</th>
                  <th>Sessions</th>
                  <th>Paid</th>
                  <th className="num" style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((grant) => (
                  <tr key={grant.id}>
                    <td className="nowrap">
                      <LocalTime iso={grant.createdAt} format="date" />
                    </td>
                    <td>{grant.note || packName(grant.packId) || 'Session credits'}</td>
                    <td className="nowrap">
                      {grant.remainingSessions} of {grant.totalSessions} left
                    </td>
                    <td>
                      {grant.paid ? (
                        <span className="pill ok">Card</span>
                      ) : (
                        <span className="pill mute">Recorded by the school</span>
                      )}
                    </td>
                    <td className="num">
                      {grant.amountPaidCents ? formatUsd(grant.amountPaidCents) : '—'}
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
