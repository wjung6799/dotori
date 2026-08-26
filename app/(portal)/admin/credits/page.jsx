'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import LocalTime from '../../LocalTime';
import { formatUsd } from '@/lib/pricing';

// The office view of every session-credit grant, and the only screen that can
// honour the promise in the pricing FAQ: "packages have an expiry window, but
// we're gracious — if life gets in the way, just ask and we'll extend it once."
// Extending is therefore the point of this page, not a footnote on it.
//
// Behind middleware.js, which already turns away anyone who is not an admin —
// so this component only has to worry about the data.

const DAY_MS = 24 * 60 * 60 * 1000;

// How far ahead counts as "expiring soon". A family needs enough warning to
// actually book the sessions they already paid for, and 30 days is roughly four
// weekly slots.
const SOON_DAYS = 30;

const FILTERS = [
  ['all', 'All grants'],
  ['soon', 'Expiring soon'],
  ['expired', 'Expired'],
  ['none', 'No expiry'],
];

// null expiresAt ALWAYS means "never lapses" — every grant made before expiry
// existed has one, and turning the feature on must not retroactively void what
// families already hold. An unparseable date is treated the same way: better a
// grant that keeps working than one voided by bad data.
function expiryState(expiresAt, now) {
  if (!expiresAt) return 'none';
  const at = new Date(expiresAt).getTime();
  if (!Number.isFinite(at)) return 'none';
  if (at <= now) return 'expired';
  if (at - now <= SOON_DAYS * DAY_MS) return 'soon';
  return 'live';
}

// Never render a raw Mongo id at a parent. populate() hands back null if the
// user was removed, so every fallback here has to end in something readable.
function familyName(user) {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return full || user?.name || user?.email || 'Unknown family';
}

export default function AdminCreditsPage() {
  const [credits, setCredits] = useState(null); // null = first load not finished
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busyId, setBusyId] = useState('');
  const [openId, setOpenId] = useState(''); // row whose inline extend control is open
  const [months, setMonths] = useState('3'); // string: a half-typed value must survive a keystroke
  const [confirm, setConfirm] = useState(null); // { id, message, body } — a second extension, held

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/credits', { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load credit grants.');
      const json = await res.json();
      setCredits(json.credits || []);
    } catch (err) {
      setCredits([]);
      setError(err.message || 'Could not load credit grants.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Recomputed whenever the list is refreshed rather than on every render, so
  // the clock a row is judged against matches the one the totals used.
  const view = useMemo(() => {
    const list = credits || [];
    const now = Date.now();
    const rows = list.map((c) => ({ credit: c, state: expiryState(c?.expiresAt, now) }));

    let live = 0;
    let soon = 0;
    let lapsed = 0;
    for (const { credit, state } of rows) {
      const remaining = Math.max(0, Number(credit?.remainingSessions) || 0);
      if (state === 'expired') lapsed += remaining;
      else live += remaining;
      if (state === 'soon') soon += remaining;
    }
    return { rows, live, soon, lapsed };
  }, [credits]);

  const loading = credits === null;
  const locked = Boolean(busyId);

  const rows = view.rows.filter(({ state }) => filter === 'all' || state === filter);

  async function patch(credit, body) {
    if (busyId) return;
    setBusyId(credit._id);
    setError('');
    setOk('');
    // Any new action supersedes a held confirmation; the retry re-sets it if the
    // server asks again.
    setConfirm(null);

    try {
      const res = await fetch(`/api/admin/credits/${credit._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));

      // The grant was already extended once. Hold the request and show the
      // server's own wording — it names the date and who did it, which is
      // exactly what the office needs to decide, and paraphrasing would lose it.
      if (res.status === 409 && json.needsConfirmation) {
        setConfirm({
          id: credit._id,
          message: json.error || 'This package was already extended once. Confirm to go ahead.',
          body,
        });
        return;
      }

      if (!res.ok || !json.ok) throw new Error(json.error || 'That change did not go through.');

      const who = familyName(credit.userId);
      setOk(
        body.action === 'never_expires'
          ? `${who}'s sessions no longer expire.`
          : `${who}'s expiry was extended.`,
      );
      setOpenId('');
      await load();
    } catch (err) {
      setError(err.message || 'That change did not go through.');
    } finally {
      setBusyId('');
    }
  }

  function extend(credit) {
    const n = Math.round(Number(months));
    // Same bounds the API enforces, checked here so a typo does not cost a
    // round trip and come back as a red notice.
    if (!Number.isFinite(n) || n < 1 || n > 24) {
      setError('Extend by between 1 and 24 months.');
      return;
    }
    patch(credit, { action: 'extend', months: n });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Session credits</h1>
          <p className="lede">
            Every pack a family holds — what is still usable, what is about to lapse, and where an
            expiry gets extended.
          </p>
        </div>
      </div>

      {error ? <div className="notice err">{error}</div> : null}
      {ok ? <div className="notice ok">{ok}</div> : null}

      <div className="grid" style={{ marginBottom: '1.1rem' }}>
        {/* Dashes rather than zeros while loading: a real 0 and an unknown must
            not look the same to the office. */}
        <div className="stat">
          <div className="label">Sessions live</div>
          <div className="value">{loading ? '—' : view.live}</div>
          <div className="hint">Remaining on grants that have not lapsed</div>
        </div>
        <div className="stat">
          <div className="label">Expiring soon</div>
          <div className="value">{loading ? '—' : view.soon}</div>
          <div className="hint">Usable for {SOON_DAYS} more days or less</div>
        </div>
        <div className="stat">
          <div className="label">Lapsed</div>
          <div className="value">{loading ? '—' : view.lapsed}</div>
          <div className="hint">Paid for but past their expiry — extendable from here</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Credit grants</h2>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter credit grants by expiry"
          >
            {FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {!loading && rows.length === 0 ? (
          <div className="empty">
            <span className="ico">🎟️</span>
            <p>
              {credits.length === 0
                ? 'No session credits yet. Grants appear here when a family buys a pack in the portal or the office adds sessions after a Zelle payment.'
                : 'No grants match this filter.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>Instructor</th>
                  <th>Sessions</th>
                  <th>Granted</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="muted small">
                      Loading credit grants…
                    </td>
                  </tr>
                ) : (
                  rows.map(({ credit, state }) => {
                    const id = credit._id;
                    const remaining = Math.max(0, Number(credit.remainingSessions) || 0);
                    const total = Math.max(0, Number(credit.totalSessions) || 0);
                    const busy = busyId === id;
                    const paid = Number(credit.amountPaidCents) || 0;

                    return (
                      <tr key={id}>
                        <td>
                          <div className="strong">{familyName(credit.userId)}</div>
                          {credit.userId?.email ? (
                            <div className="muted small">{credit.userId.email}</div>
                          ) : null}
                        </td>

                        {/* No tutor on the grant means the credits work with
                            whoever has a seat open, not that data is missing. */}
                        <td>{credit.tutorId?.name || <span className="muted">Any</span>}</td>

                        <td>
                          <div className="nowrap">
                            {remaining} of {total} left
                          </div>
                          {credit.note ? <div className="muted small">{credit.note}</div> : null}
                        </td>

                        <td>
                          <div className="nowrap">
                            {credit.createdAt ? (
                              <LocalTime iso={credit.createdAt} format="date" />
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                          {credit.grantedBy ? (
                            <div className="muted small">by {credit.grantedBy}</div>
                          ) : null}
                          {paid > 0 ? <div className="muted small">{formatUsd(paid)}</div> : null}
                        </td>

                        <td>
                          {credit.expiresAt ? (
                            <div className="nowrap">
                              <LocalTime iso={credit.expiresAt} format="date" />
                            </div>
                          ) : (
                            <>
                              {/* null is a promise, not a gap: these sessions
                                  never lapse and must never read as expired. */}
                              <div className="muted">—</div>
                              <div className="muted small">never expires</div>
                            </>
                          )}

                          {state === 'soon' ? (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span className="pill warn">Soon</span>
                            </div>
                          ) : null}
                          {state === 'expired' ? (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span className="pill err">Expired</span>
                            </div>
                          ) : null}

                          {credit.extendedAt ? (
                            <div className="muted small">
                              extended by {credit.extendedBy || 'the office'}
                            </div>
                          ) : null}
                        </td>

                        <td>
                          {remaining === 0 ? (
                            // Nothing left to rescue, so an expiry on this grant
                            // changes nothing for the family.
                            <span className="muted small nowrap">used up</span>
                          ) : openId === id ? (
                            <div
                              style={{
                                display: 'flex',
                                gap: '0.4rem',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                              }}
                            >
                              {/* .field controls are width:100%; this one has to
                                  sit beside its buttons. */}
                              <input
                                className="input"
                                style={{ width: '5rem' }}
                                type="number"
                                min="1"
                                max="24"
                                step="1"
                                value={months}
                                onChange={(e) => setMonths(e.target.value)}
                                disabled={locked}
                                aria-label="Months to extend by"
                              />
                              <span className="muted small">months</span>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={locked}
                                onClick={() => extend(credit)}
                              >
                                {busy ? 'Saving…' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={locked}
                                onClick={() => setOpenId('')}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={locked}
                                onClick={() => {
                                  // Three months is the gracious extension the
                                  // FAQ implies; the office can type another.
                                  setMonths('3');
                                  setOpenId(id);
                                  setError('');
                                }}
                              >
                                Extend
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={locked}
                                onClick={() => patch(credit, { action: 'never_expires' })}
                              >
                                {busy ? 'Saving…' : 'Never expires'}
                              </button>
                            </div>
                          )}

                          {/* The second-extension warning belongs next to the
                              grant it is about, and it carries the only button
                              that can go through with it. */}
                          {confirm?.id === id ? (
                            <div className="notice warn mb0" style={{ marginTop: '0.6rem' }}>
                              <div>{confirm.message}</div>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.4rem',
                                  flexWrap: 'wrap',
                                  marginTop: '0.6rem',
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn btn-accent btn-sm"
                                  disabled={locked}
                                  onClick={() =>
                                    patch(credit, {
                                      ...confirm.body,
                                      acknowledgeSecondExtension: true,
                                    })
                                  }
                                >
                                  Yes, extend again
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  disabled={locked}
                                  onClick={() => setConfirm(null)}
                                >
                                  Leave it
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted small" style={{ marginTop: '1rem', marginBottom: 0 }}>
          The pricing FAQ promises families one gracious extension when life gets in the way. A
          grant with no expiry date never lapses — leave those alone.
        </p>
      </div>
    </>
  );
}
