'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import {
  CREDIT_PACKS,
  HOURS_PER_SESSION,
  PAYMENT_ADJUSTMENT,
  defaultOnlineFeeCents,
  formatUsd,
  hoursForRate,
  lengthLabel,
  tutorPackId,
  validityLabel,
} from '@/lib/pricing';

// Where the office prices each tutor. Session credits are per tutor: a family
// picks who they want first and is shown that tutor's rates, so this page is
// the only place those numbers come from. Only the two figures are stored —
// the package name and the total are derived from them, which is why the total
// column here recomputes as you type rather than being something you fill in.

// Fees are switched off school-wide right now, so every total is the tuition
// figure and nothing else. Kept as a flag so the column stays honest if the
// switch in lib/pricing.js is ever flipped back on.
const FEES_ON = PAYMENT_ADJUSTMENT.mode !== 'none';

// Rows need a key that survives a reorder or a removal; a tutor's rates have no
// id of their own, and an array index makes React reuse the wrong input when a
// middle row is removed.
let rowSeq = 0;
function toRow(rate) {
  rowSeq += 1;
  return {
    key: `row-${rowSeq}`,
    // Held as strings: these are what the inputs show, and a half-typed "1." has
    // to survive a keystroke without being coerced to a number.
    sessions: rate?.sessions === undefined || rate?.sessions === null ? '' : String(rate.sessions),
    ratePerHour:
      rate?.ratePerHour === undefined || rate?.ratePerHour === null ? '' : String(rate.ratePerHour),
    // Typed in MINUTES, which is the unit a schedule is written in. Blank means
    // the school-wide session length, so an existing row that never had one
    // keeps behaving exactly as it did.
    minutes:
      rate?.hoursPerSession === undefined || rate?.hoursPerSession === null
        ? ''
        : String(Math.round(rate.hoursPerSession * 60)),
    name: rate?.name || '',
    // Blank is a real setting, not a missing one: it means the package never
    // lapses, which is what every credit granted before expiry existed carries.
    validMonths:
      rate?.validMonths === undefined || rate?.validMonths === null
        ? ''
        : String(rate.validMonths),
    tag: rate?.tag || '',
    // Semi-private or private. These are separate products at separate rates,
    // so a package has to say which one it is; unset rows are the group room,
    // which is what every rate on file before kinds existed was.
    sessionType: rate?.sessionType === 'private' ? 'private' : 'semi_private',
  };
}

// Minutes as typed → hours as stored. Null for a blank or nonsense box, which
// is how a row says "use the school's session length".
function rowHours(row) {
  const mins = Number(row.minutes);
  return Number.isFinite(mins) && mins >= 15 ? mins / 60 : null;
}

// What a family pays for this row, in cents. Null while the row is still blank
// or nonsense, so the cell can say "—" instead of "$0".
function rowTotalCents(row) {
  const sessions = Number(row.sessions);
  const ratePerHour = Number(row.ratePerHour);
  if (!Number.isFinite(sessions) || !Number.isFinite(ratePerHour)) return null;
  if (sessions <= 0 || ratePerHour <= 0) return null;
  return Math.round(ratePerHour * hoursForRate({ hoursPerSession: rowHours(row) }) * sessions * 100);
}

export default function AdminRatesPage() {
  const [tutors, setTutors] = useState(null); // null = still loading
  const [rowsById, setRowsById] = useState({});
  const [busyId, setBusyId] = useState(''); // one tutor saves at a time, per card
  const [msgById, setMsgById] = useState({}); // { [tutorId]: { type, text } }
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tutors', { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load the tutor list.');
      const data = await res.json();
      const list = data.tutors || [];
      setTutors(list);
      setRowsById(
        Object.fromEntries(list.map((t) => [t._id, (t.rates || []).map(toRow)])),
      );
      setLoadError('');
    } catch (err) {
      setTutors([]);
      setLoadError(err.message || 'Could not load the tutor list.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setRow(tutorId, key, field, value) {
    setRowsById((prev) => ({
      ...prev,
      [tutorId]: (prev[tutorId] || []).map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    }));
  }

  function addRow(tutorId) {
    setRowsById((prev) => ({ ...prev, [tutorId]: [...(prev[tutorId] || []), toRow(null)] }));
    setMsgById((prev) => ({ ...prev, [tutorId]: null }));
  }

  function removeRow(tutorId, key) {
    setRowsById((prev) => ({
      ...prev,
      [tutorId]: (prev[tutorId] || []).filter((r) => r.key !== key),
    }));
    setMsgById((prev) => ({ ...prev, [tutorId]: null }));
  }

  async function saveRates(tutor) {
    if (busyId) return;
    const rows = rowsById[tutor._id] || [];

    // Only complete rows are sendable. A blank session count leaves here as 0,
    // and the API floors that to 1 rather than rejecting it — which would put a
    // one-session package on sale at this rate instead of dropping the row the
    // way the hint below promises.
    const rates = rows
      .map((r) => {
        // Blank — or anything that is not a whole month — is "never lapses",
        // sent as an explicit null. Never 0: Number('') is 0, and a 0-month
        // window would read as a package that expires the moment it is bought.
        const months = Math.round(Number(r.validMonths));
        return {
          sessions: Math.round(Number(r.sessions)),
          ratePerHour: Number(r.ratePerHour),
          // Blank = the school's session length, sent as an explicit null so a
          // row that never had one keeps behaving as it always did.
          hoursPerSession: rowHours(r),
          name: r.name.trim(),
          validMonths: Number.isFinite(months) && months >= 1 ? months : null,
          sessionType: r.sessionType === 'private' ? 'private' : 'semi_private',
          tag: r.tag.trim(),
        };
      })
      .filter(
        (r) =>
          Number.isFinite(r.sessions) &&
          r.sessions > 0 &&
          Number.isFinite(r.ratePerHour) &&
          r.ratePerHour > 0,
      );

    // packsForTutor() keys a package by its size, rate and lesson length, and
    // findTutorPack() resolves a family's purchase by that id. Two rows that
    // collapse to the same key would leave the family charged the FIRST row's
    // price whichever card they picked, so refuse the save rather than ship an
    // ambiguous price list. Length is part of the key, which is what lets a
    // 60-minute 1:1 quarter and a 90-minute semi-private one both be "12".
    const ids = rates.map((r) =>
      tutorPackId(r.sessions, r.ratePerHour, hoursForRate({ hoursPerSession: r.hoursPerSession })),
    );
    if (ids.some((id, i) => ids.indexOf(id) !== i)) {
      setMsgById((prev) => ({
        ...prev,
        [tutor._id]: {
          type: 'err',
          text: 'Two rows are the same package — same session count, same hourly rate and same lesson length. A family would be charged the first of them whichever one they picked, so change or remove one.',
        },
      }));
      return;
    }

    setBusyId(tutor._id);
    setMsgById((prev) => ({ ...prev, [tutor._id]: null }));
    try {
      const res = await fetch(`/api/admin/tutors/${tutor._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) throw new Error(payload.error || 'Could not save these rates.');

      // Re-read from the response rather than trusting the draft: the API drops
      // any row missing a session count or a rate, and the office should see
      // exactly what was kept rather than a row that quietly did not save.
      const saved = payload.tutor;
      const savedRates = saved?.rates || [];
      setTutors((prev) =>
        (prev || []).map((t) => (t._id === tutor._id ? { ...t, rates: savedRates } : t)),
      );
      setRowsById((prev) => ({ ...prev, [tutor._id]: savedRates.map(toRow) }));

      // Counted against the rows the office actually had on screen, not the
      // filtered send: a row dropped here is exactly as unsaved as one the
      // API rejected, and the message has to own both.
      const dropped = rows.length - savedRates.length;
      setMsgById((prev) => ({
        ...prev,
        [tutor._id]: {
          type: 'ok',
          text:
            dropped > 0
              ? `Saved. ${dropped} incomplete ${dropped === 1 ? 'row was' : 'rows were'} dropped — a row needs both a session count and a rate above $0.`
              : savedRates.length === 0
                ? 'Saved. With no rates of their own, this tutor is back on the school defaults.'
                : 'Saved. Families booking this tutor see these prices now.',
        },
      }));
    } catch (err) {
      setMsgById((prev) => ({
        ...prev,
        [tutor._id]: { type: 'err', text: err.message || 'Could not save these rates.' },
      }));
    } finally {
      setBusyId('');
    }
  }

  const loading = tutors === null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tutor rates</h1>
          <p className="lede">What each tutor charges for session credits.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" href="/admin/booking">
          Tutors &amp; availability →
        </Link>
      </div>

      <p className="muted small" style={{ margin: '-0.6rem 0 1.2rem', maxWidth: '62ch' }}>
        Every tutor sets their own rates. A family picks the tutor before they buy, sees that
        tutor&apos;s prices, and a credit bought for a tutor books that tutor. A tutor with no rates
        here falls back to the school defaults, so a newly added tutor is sellable straight away.
      </p>

      {loadError ? <div className="notice err">{loadError}</div> : null}

      {loading ? (
        <div className="card">
          <div className="card-head">
            <h2>Loading tutors…</h2>
          </div>
          <div className="empty">
            <span className="ico">💵</span>
            <p>Fetching who is on the books.</p>
          </div>
        </div>
      ) : tutors.length === 0 ? (
        <div className="card">
          <div className="empty">
            <span className="ico">🙋</span>
            <p>
              No tutors yet. Add one on <Link href="/admin/booking">Tutors &amp; availability</Link>,
              then come back here to price them.
            </p>
          </div>
        </div>
      ) : (
        tutors.map((tutor) => {
          const rows = rowsById[tutor._id] || [];
          const msg = msgById[tutor._id];
          const saving = busyId === tutor._id;
          const usingDefaults = (tutor.rates || []).length === 0;

          return (
            <div className="card" key={tutor._id}>
              <div className="card-head">
                <h2>
                  {tutor.name}
                  {tutor.active === false ? (
                    <span className="pill mute" style={{ marginLeft: '0.5rem' }}>
                      Hidden
                    </span>
                  ) : null}
                </h2>
                <span className="muted small">{tutor.specialty || 'No specialty listed'}</span>
              </div>

              {msg ? <div className={`notice ${msg.type}`}>{msg.text}</div> : null}

              {usingDefaults ? (
                <div className="notice info">
                  <strong>{tutor.name} is on the school default rates.</strong> Families booking
                  them currently see:{' '}
                  {CREDIT_PACKS.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 ? ' · ' : ''}
                      {p.name} — {p.sessions} session{p.sessions === 1 ? '' : 's'},{' '}
                      {formatUsd(p.amountCents)} ({validityLabel(p.validMonths)})
                    </span>
                  ))}
                  . Add rates below to replace that list for this tutor.
                </div>
              ) : null}

              {rows.length === 0 ? (
                <div className="empty">
                  <span className="ico">🏷</span>
                  <p>No rate rows. Add one to price this tutor yourself.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Kind</th>
                        <th>Package name</th>
                        <th>Sessions</th>
                        <th>Each</th>
                        <th>Rate per hour</th>
                        <th>Label</th>
                        <th>Valid for</th>
                        <th style={{ textAlign: 'right' }}>Family pays</th>
                        <th aria-label="Remove" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const cents = rowTotalCents(row);
                        // Only ever a real figure: with fees off this is 0 and
                        // the line stays out rather than showing a $0 row.
                        const feeCents = FEES_ON && cents !== null ? defaultOnlineFeeCents(cents) : 0;
                        return (
                          <tr key={row.key}>
                            <td>
                              {/* Which product this package is. A family buying
                                  private credits can only book slots opened as
                                  private, so this has to match what the tutor
                                  actually offers. */}
                              <select
                                value={row.sessionType}
                                aria-label={`Session kind for ${tutor.name}`}
                                onChange={(e) =>
                                  setRow(tutor._id, row.key, 'sessionType', e.target.value)
                                }
                                style={{ width: '9rem' }}
                              >
                                <option value="semi_private">Semi-private</option>
                                <option value="private">Private (1:1)</option>
                              </select>
                            </td>
                            <td>
                              <input
                                className="input"
                                type="text"
                                maxLength={60}
                                placeholder={`${row.sessions || 'N'}-Session Package`}
                                aria-label={`Package name for ${tutor.name}`}
                                value={row.name}
                                onChange={(e) => setRow(tutor._id, row.key, 'name', e.target.value)}
                                style={{ width: '13rem' }}
                              />
                            </td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                aria-label={`Sessions for ${tutor.name}`}
                                value={row.sessions}
                                onChange={(e) =>
                                  setRow(tutor._id, row.key, 'sessions', e.target.value)
                                }
                                style={{ width: '6rem' }}
                              />
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                                <input
                                  className="input"
                                  type="number"
                                  min="15"
                                  step="5"
                                  inputMode="numeric"
                                  placeholder={String(HOURS_PER_SESSION * 60)}
                                  aria-label={`Minutes in one session, for ${tutor.name}`}
                                  value={row.minutes}
                                  onChange={(e) =>
                                    setRow(tutor._id, row.key, 'minutes', e.target.value)
                                  }
                                  style={{ width: '5.5rem' }}
                                />
                                <span className="muted small nowrap">min</span>
                              </div>
                            </td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                aria-label={`Rate per hour for ${tutor.name}`}
                                value={row.ratePerHour}
                                onChange={(e) =>
                                  setRow(tutor._id, row.key, 'ratePerHour', e.target.value)
                                }
                                style={{ width: '7.5rem' }}
                              />
                            </td>
                            <td>
                              <input
                                className="input"
                                type="text"
                                maxLength={40}
                                placeholder="Best value"
                                aria-label={`Label for ${tutor.name}`}
                                value={row.tag}
                                onChange={(e) => setRow(tutor._id, row.key, 'tag', e.target.value)}
                                style={{ width: '11rem' }}
                              />
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                                <input
                                  className="input"
                                  type="number"
                                  min="1"
                                  step="1"
                                  inputMode="numeric"
                                  placeholder="no expiry"
                                  aria-label={`Months this package stays usable, for ${tutor.name}`}
                                  value={row.validMonths}
                                  onChange={(e) =>
                                    setRow(tutor._id, row.key, 'validMonths', e.target.value)
                                  }
                                  style={{ width: '7rem' }}
                                />
                                <span className="muted small nowrap">months</span>
                              </div>
                            </td>
                            <td className="num">
                              <span className="strong">{cents === null ? '—' : formatUsd(cents)}</span>
                              {feeCents > 0 ? (
                                <div className="muted small">+ {formatUsd(feeCents)} online fee</div>
                              ) : null}
                            </td>
                            <td className="num">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => removeRow(tutor._id, row.key)}
                                disabled={saving}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="field" style={{ marginTop: '0.6rem', marginBottom: '0.9rem' }}>
                <div className="hint">
                  What a family pays is rate per hour × session length × sessions. Leave
                  &ldquo;Each&rdquo; blank and a session is the school default of{' '}
                  {lengthLabel(HOURS_PER_SESSION)}; fill it in for an instructor whose lessons are
                  shorter, or who sells more than one length (60-minute weekday 1:1 alongside
                  90-minute Saturday blocks). Name the package and that name is what the family
                  sees — blank falls back to &ldquo;12-Session Package&rdquo;, which reads wrong
                  when two packages are the same size and a different length. A row needs both a
                  session count and a rate above $0 to be saved. &ldquo;Valid for&rdquo; is how long
                  the sessions stay usable after a family buys them — leave it blank and the package
                  never expires. Give a bigger package a longer window: forty weekly sessions cannot
                  be used up inside three months.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => addRow(tutor._id)}
                  disabled={saving}
                >
                  + Add rate
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => saveRates(tutor)}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save rates'}
                </button>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
