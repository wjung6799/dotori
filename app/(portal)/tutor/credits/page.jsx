'use client';

import { useCallback, useEffect, useState } from 'react';
import LocalTime from '../../LocalTime';

// Session tokens a family bought from you offline — Zelle, cash, a cheque — and
// the balance they can book against. This lived inside the availability page for
// a while, which was wrong: when you teach and who owes you money are different
// jobs, and burying one under the other means nobody finds it.
//
// A grant here is scoped to you, so it only ever buys time with you.
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

export default function TutorCreditsPage() {

  const [families, setFamilies] = useState(null); // null while loading, [] when genuinely empty
  const [grants, setGrants] = useState(null); // null while loading, [] when genuinely empty
  const [userId, setUserId] = useState('');
  const [sessions, setSessions] = useState('1');
  const [note, setNote] = useState('');
  // Months, as a string so a half-typed value survives a keystroke. Blank means
  // the tokens never lapse, which is how every grant behaved before expiry.
  const [validMonths, setValidMonths] = useState('');
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
        body: JSON.stringify({
          userId,
          sessions: Number(sessions),
          note,
          // null, never 0 — a 0 would read as tokens that expired on purchase.
          validMonths: validMonths.trim() === '' ? null : Number(validMonths),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: d.error || 'Failed.' });
      } else {
        setMsg({ ok: true, text: 'Sessions added.' });
        setNote('');
      setValidMonths('');
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
      <div className="page-head">
        <div>
          <h1>Session tokens</h1>
          <p className="lede">
            Sessions a family paid you for outside the portal, and what they have left. (수업 토큰)
          </p>
        </div>
      </div>

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

          <div className="field">
            <label htmlFor="grant-expiry">Valid for (months)</label>
            <input
              id="grant-expiry"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="no expiry"
              value={validMonths}
              onChange={(e) => setValidMonths(e.target.value)}
              style={{ width: '8rem' }}
              aria-label="Months these tokens stay usable. Leave blank for no expiry."
            />
            <p className="hint">
              Leave blank and they never expire. Otherwise the family is warned a month before and
              again a week before, and the office can extend once.
            </p>
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
                  {/* A null expiry means these never lapse — say so rather than
                      leaving a blank the tutor has to interpret. */}
                  <div className="meta small">
                    {g.expiresAt ? (
                      <>
                        Usable until <LocalTime iso={g.expiresAt} format="date" />
                        {g.extendedAt ? ' (extended)' : null}
                      </>
                    ) : (
                      'No expiry'
                    )}
                  </div>
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
