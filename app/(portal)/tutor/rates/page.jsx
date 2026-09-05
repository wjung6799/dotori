'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { formatUsd, lengthLabel, validityLabel } from '@/lib/pricing';
import {
  PRIVATE,
  SEMI_PRIVATE,
  SESSION_TYPES,
  SESSION_TYPE_BLURB,
  sessionTypeLabel,
} from '@/lib/sessionTypes';

// An instructor prices their own session credits. Credits are per instructor —
// a family picks who they want first and is then quoted THIS list — so these
// numbers are the only prices anyone booking this instructor ever sees.
//
// The total a family pays is never stored — it is derived from the size, the
// hourly rate and how long one lesson runs. That is why the total column
// recomputes as you type instead of being something you fill in: it is the whole
// point of the screen, and a tutor should never have to do the multiplication in
// their head to find out what they just priced.
//
// The default session length is not imported here — the API sends it, so the
// arithmetic on screen can never drift from the arithmetic the server saves
// against.
//
// Each package sells ONE kind of session, semi-private or private. They are
// separate products at separate rates, so a tutor is really maintaining two
// price ladders here; the editor keeps them in one table (a package is a package)
// but the live price list below is split by kind, because a family is only ever
// shown one ladder at a time and interleaving them hides what was priced.

const plural = (n) => (n === 1 ? '' : 's');

// Rows need a key that survives a reorder or a removal. A tutor's rates have no
// id of their own, and an array index makes React reuse the wrong input when a
// middle row is removed — you delete row 2 and row 3's half-typed rate slides up
// into its box.
let rowSeq = 0;
function toRow(rate) {
  rowSeq += 1;
  return {
    key: `row-${rowSeq}`,
    // Held as STRINGS: these are exactly what the inputs show, and a half-typed
    // "1." or "" has to survive a keystroke without being coerced to a number.
    sessions:
      rate?.sessions === undefined || rate?.sessions === null ? '' : String(rate.sessions),
    ratePerHour:
      rate?.ratePerHour === undefined || rate?.ratePerHour === null ? '' : String(rate.ratePerHour),
    // Typed in MINUTES, the unit a timetable is written in. Blank means the
    // school's own session length, so a package that never set one is unchanged.
    minutes:
      rate?.hoursPerSession === undefined || rate?.hoursPerSession === null
        ? ''
        : String(Math.round(rate.hoursPerSession * 60)),
    // Which product this package sells. Semi-private is the default for a new
    // row and for a rate written before kinds existed — the same fallback the
    // API and packsForTutor use, so the editor never shows a kind the server
    // would not have stored.
    sessionType: rate?.sessionType === PRIVATE ? PRIVATE : SEMI_PRIVATE,
    name: rate?.name || '',
    tag: rate?.tag || '',
    // Blank is a real answer here, not a missing one: null months means the
    // package never lapses, and an empty box is how a tutor types that.
    validMonths:
      rate?.validMonths === undefined || rate?.validMonths === null
        ? ''
        : String(rate.validMonths),
  };
}

// Minutes as typed → hours as stored. Null for a blank or nonsense box, which
// is this row saying "use the school's session length".
function rowHours(row) {
  const mins = Number(row.minutes);
  return Number.isFinite(mins) && mins >= 15 ? mins / 60 : null;
}

// What a family pays for this row, in cents — null while the row is still blank
// or nonsense, so the cell can say "—" rather than a misleading $0.
function rowTotalCents(row, hoursPerSession) {
  const hours = rowHours(row) ?? hoursPerSession;
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const sessions = Number(row.sessions);
  const ratePerHour = Number(row.ratePerHour);
  if (!Number.isFinite(sessions) || !Number.isFinite(ratePerHour)) return null;
  if (sessions <= 0 || ratePerHour <= 0) return null;
  return Math.round(ratePerHour * hours * sessions * 100);
}

// The live price list, split into the ladders a family is actually shown. A pack
// with no kind on it came from a rate written before kinds existed, and is
// stored and sold as semi-private everywhere else — so it reads as semi-private
// here rather than becoming a third, nameless group. Empty ladders are dropped:
// a tutor who only sells semi-private should see one heading, not an empty
// "Private" shelf implying they offer something they have not priced.
function packsByType(packs) {
  return SESSION_TYPES.map((type) => ({
    type,
    list: (packs || []).filter((p) => (p?.sessionType === PRIVATE ? PRIVATE : SEMI_PRIVATE) === type),
  })).filter((group) => group.list.length > 0);
}

export default function TutorRatesPage() {
  const [data, setData] = useState(null); // null = still loading
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text }
  const [loadError, setLoadError] = useState(''); // 403 / network, shown as a warning
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tutor/rates', { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A login that is not linked to an instructor profile gets a plain 403
        // message. Say so rather than showing an empty editor that would look
        // like "you have no packages" and invite a save that cannot land.
        throw new Error(payload.error || 'We could not load your rates just now.');
      }
      setData(payload);
      setRows((payload.rates || []).map(toRow));
      setLoadError('');
    } catch (err) {
      setLoadError(err.message || 'We could not load your rates just now.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setRow(key, field, value) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    setMsg(null);
  }

  function addRow() {
    setRows((prev) => [...prev, toRow(null)]);
    setMsg(null);
  }

  function removeRow(key) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setMsg(null);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    try {
      // Every row goes up exactly as typed. The route drops a row missing either
      // number and reports how many it dropped — filtering here first would zero
      // that count and quietly swallow the half-filled row the tutor can still
      // see on screen. (A blank session count arrives as 0 and is skipped, not
      // floored to a live 1-session package.)
      const res = await fetch('/api/tutor/rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rates: rows.map((r) => ({
            sessions: r.sessions,
            ratePerHour: r.ratePerHour,
            // Which product this package sells. The route only accepts the two
            // known kinds and falls back to semi-private, so a row is never
            // saved as a kind nothing can book.
            sessionType: r.sessionType,
            // Blank means "the school's session length", sent as null so a
            // package that never set one is left exactly as it was.
            hoursPerSession: rowHours(r),
            name: r.name.trim(),
            tag: r.tag.trim(),
            // Blank means "never lapses", so send null — a 0 would read as a
            // package that has already expired by the time it is paid for.
            validMonths: (r.validMonths || '').trim() === '' ? null : r.validMonths,
          })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      // Two packages of the same session count come back with a specific message
      // naming the size — pass it through instead of a generic failure.
      if (!res.ok || !payload.ok) throw new Error(payload.error || 'Could not save these rates.');

      const savedRates = payload.rates || [];
      // Re-seed from the response, not from the draft: the server sorts by size
      // and drops incomplete rows, and the tutor should be looking at exactly
      // what is now on sale rather than a row that quietly did not save.
      setRows(savedRates.map(toRow));
      setData((prev) => ({
        ...(prev || {}),
        rates: savedRates,
        usesDefaultRates: payload.usesDefaultRates,
        packs: payload.packs || [],
      }));

      const dropped = payload.dropped || 0;
      const droppedText =
        dropped > 0
          ? ` ${dropped} incomplete ${dropped === 1 ? 'row was' : 'rows were'} dropped — a row needs both a session count and a rate above $0.`
          : '';
      setMsg({
        type: 'ok',
        text:
          savedRates.length === 0
            ? `Saved.${droppedText} With no packages of your own, you are back on the school default rates.`
            : `Saved. Families booking you see these prices now.${droppedText}`,
      });
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Could not save these rates.' });
    } finally {
      setSaving(false);
    }
  }

  const loading = !data && !loadError;
  const hoursPerSession = Number(data?.hoursPerSession);
  const defaults = data?.defaults || [];
  const packs = data?.packs || [];
  const packGroups = packsByType(packs);
  const outstanding = data?.outstandingCredits || 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My rates</h1>
          <p className="lede">
            What families pay for session packages with you.
          </p>
        </div>
        {data?.tutor ? (
          <span className="muted small">
            {data.tutor.name}
            {data.tutor.specialty ? ` · ${data.tutor.specialty}` : ''}
          </span>
        ) : null}
      </div>

      {loadError ? <div className="notice warn">{loadError}</div> : null}

      <div className="card">
        <div className="card-head">
          <h2>Your packages</h2>
          <Link className="link" href="/tutor/bookings">
            My bookings →
          </Link>
        </div>

        {msg ? <div className={`notice ${msg.type}`}>{msg.text}</div> : null}

        {data?.usesDefaultRates ? (
          <div className="notice info">
            <strong>You are on the school default rates.</strong> Families booking you currently
            see:{' '}
            {defaults.map((d, i) => (
              <span key={`${d.name}-${d.sessions}`}>
                {i > 0 ? ' · ' : ''}
                {d.name} — {d.sessions} session{plural(d.sessions)}, {formatUsd(d.amountCents)}
              </span>
            ))}
            . Add packages below to replace that list with your own.
          </div>
        ) : null}

        {loading ? (
          <div className="empty">
            <span className="ico">🏷</span>
            <p>Loading your rates…</p>
          </div>
        ) : loadError ? (
          <div className="empty">
            <span className="ico">🏷</span>
            <p>Nothing to edit until your account is linked to an instructor profile.</p>
          </div>
        ) : (
          <>
            {rows.length === 0 ? (
              <div className="empty">
                <span className="ico">🏷</span>
                <p>No packages of your own yet. Add one to set your prices.</p>
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
                      <th>Valid for (months)</th>
                      {/* table.data styles td.num, not th.num — align this one by hand */}
                      <th style={{ textAlign: 'right' }}>Families pay</th>
                      <th aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const cents = rowTotalCents(row, hoursPerSession);
                      return (
                        <tr key={row.key}>
                          <td>
                            {/* Every kind the school sells, listed from the one
                                place the vocabulary is defined — a hard-coded
                                pair here would go stale the day a third appears.
                                .input is width:100%, so this needs a width. */}
                            <select
                              className="input"
                              aria-label="Kind of session this package sells"
                              value={row.sessionType}
                              onChange={(e) => setRow(row.key, 'sessionType', e.target.value)}
                              style={{ width: '9.5rem' }}
                            >
                              {SESSION_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {sessionTypeLabel(t)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="input"
                              type="text"
                              maxLength={60}
                              placeholder={`${row.sessions || 'N'}-Session Package`}
                              aria-label="Name families see for this package"
                              value={row.name}
                              onChange={(e) => setRow(row.key, 'name', e.target.value)}
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
                              aria-label="Sessions in this package"
                              value={row.sessions}
                              onChange={(e) => setRow(row.key, 'sessions', e.target.value)}
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
                                placeholder={String(
                                  Math.round((Number.isFinite(hoursPerSession) ? hoursPerSession : 2) * 60),
                                )}
                                aria-label="Minutes in one session of this package"
                                value={row.minutes}
                                onChange={(e) => setRow(row.key, 'minutes', e.target.value)}
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
                              aria-label="Rate per hour in dollars"
                              value={row.ratePerHour}
                              onChange={(e) => setRow(row.key, 'ratePerHour', e.target.value)}
                              style={{ width: '7.5rem' }}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              type="text"
                              maxLength={40}
                              placeholder="Best value"
                              aria-label="Label for this package (optional)"
                              value={row.tag}
                              onChange={(e) => setRow(row.key, 'tag', e.target.value)}
                              style={{ width: '11rem' }}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              type="number"
                              min="1"
                              step="1"
                              inputMode="numeric"
                              placeholder="no expiry"
                              aria-label="Months this package stays usable (blank for no expiry)"
                              value={row.validMonths}
                              onChange={(e) => setRow(row.key, 'validMonths', e.target.value)}
                              style={{ width: '7rem' }}
                            />
                          </td>
                          <td className="num">
                            <span className="strong">{cents === null ? '—' : formatUsd(cents)}</span>
                          </td>
                          <td className="num">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeRow(row.key)}
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
                “Each” blank and one session is{' '}
                {lengthLabel(Number.isFinite(hoursPerSession) ? hoursPerSession : 2)}, the school
                default; fill it in if your lessons are shorter, or if you sell more than one length
                — 60-minute weekday 1:1 alongside 90-minute Saturday blocks. The package name is
                what families see, and it is worth writing when two packages are the same size at
                different lengths; blank falls back to “12-Session Package”. A row needs both a
                session count and a rate above $0 to be saved — anything less is dropped when you
                save. Save with no rows at all and you go back to the school defaults. Leave “Valid
                for” blank and that package never expires; fill it in and it is how many months a
                family has to use the sessions. A bigger package needs a longer window — forty
                weekly sessions cannot be used inside three months.
              </div>
              {/* Kept as its own paragraph: the trap below is the one thing on
                  this screen a tutor can get wrong without seeing an error. */}
              <div className="hint">
                “Kind” is which product the package sells, and the two are priced
                separately. <strong>Semi-private</strong> is the small-group room — a few
                students share the slot, each on their own plan. <strong>Private</strong> is
                one student for the whole slot. A family who buys private credits can only
                spend them on slots you have opened as private, so pricing a private
                package without opening any private slots sells something nobody can book.
                Open them in{' '}
                <Link className="link" href="/tutor/availability">
                  My availability
                </Link>
                .
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={addRow}
                disabled={saving}
              >
                + Add a package
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save rates'}
              </button>
            </div>

            {/* The obvious worry when an expiry column appears on a live price list. */}
            <p className="muted small" style={{ margin: '0.9rem 0 0', maxWidth: '62ch' }}>
              An expiry is stamped onto a package when it is bought, so a window you change here
              only applies to packages bought from now on. Sessions a family already holds keep the
              expiry they were sold with.
            </p>

            {outstanding > 0 ? (
              <p className="muted small" style={{ margin: '0.9rem 0 0', maxWidth: '62ch' }}>
                {outstanding} session{plural(outstanding)} {outstanding === 1 ? 'is' : 'are'}{' '}
                already paid for at your current prices. Changing your rates here only affects new
                purchases — nothing a family has already bought is re-priced.
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* ── The same cards a family is shown when they pick you ──────────── */}
      <div className="card">
        <div className="card-head">
          <h2>What families see</h2>
          <span className="muted small">Your live price list</span>
        </div>

        {loading ? (
          <div className="empty">
            <span className="ico">🎟</span>
            <p>Loading your price list…</p>
          </div>
        ) : packs.length === 0 ? (
          <div className="empty">
            <span className="ico">🎟</span>
            <p>
              {loadError
                ? 'Nothing is quoted for you until your account is linked to an instructor profile.'
                : 'Nothing is on sale for you yet. Add a package above and save.'}
            </p>
          </div>
        ) : (
          <>
            <p className="muted small" style={{ margin: '0 0 0.9rem', maxWidth: '62ch' }}>
              Saved prices only — a row you are still typing shows up here after you save.
            </p>
            {/* One ladder per kind, in the order the vocabulary lists them, so a
                tutor selling both reads their semi-private prices top to bottom
                and then their private ones — not the two interleaved by size. */}
            {packGroups.map((group) => (
              <div key={group.type} style={{ marginBottom: '1.2rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                  {sessionTypeLabel(group.type)}
                </h3>
                <p className="muted small" style={{ margin: '0.15rem 0 0.7rem' }}>
                  {SESSION_TYPE_BLURB[group.type]}
                </p>
                <div className="grid">
                  {group.list.map((p) => (
                    <div
                      className="card"
                      key={p.id}
                      style={{ margin: 0, boxShadow: 'none', background: 'var(--surface-2)' }}
                    >
                      <div className="card-head" style={{ marginBottom: '0.5rem' }}>
                        <h2>{p.name}</h2>
                        {p.tag ? <span className="pill mute">{p.tag}</span> : null}
                      </div>

                      <div className="strong" style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}>
                        {formatUsd(p.amountCents)}
                      </div>
                      <p className="muted small" style={{ margin: '0.15rem 0 0.6rem' }}>
                        ${p.ratePerHour}/hour · {p.sessions} session{plural(p.sessions)}
                        {p.hoursPerSession ? ` × ${lengthLabel(p.hoursPerSession)}` : ''} ·{' '}
                        {validityLabel(p.validMonths)}
                      </p>

                      {(p.lines || []).length > 0 ? (
                        <ul
                          className="small muted"
                          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.3rem' }}
                        >
                          {p.lines.map((line) => (
                            <li key={line}>· {line}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
