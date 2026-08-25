'use client';

import { useEffect, useState } from 'react';

import LocalTime from '../../LocalTime';

const FILTERS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['declined', 'Declined'],
];

function money(cents) {
  const c = cents || 0;
  return '$' + (c / 100).toLocaleString('en-US', {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// Terms are stored as slugs ("fall-2026") but the office reads them as words.
function termLabel(quarter) {
  if (!quarter) return '';
  return quarter
    .split('-')
    .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function statusPill(status) {
  if (status === 'approved') return 'pill ok';
  if (status === 'declined') return 'pill mute';
  if (status === 'pending') return 'pill warn';
  return 'pill info';
}

export default function AdminRequestsPage() {
  const [filter, setFilter] = useState('pending'); // pending is the only status anyone acts on
  const [requests, setRequests] = useState(null); // null = still loading
  const [pendingCount, setPendingCount] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [msg, setMsg] = useState(null); // result of the last decision: { type, text }
  const [reloadKey, setReloadKey] = useState(0);
  const [declining, setDeclining] = useState(''); // id of the request whose reason box is open
  const [reason, setReason] = useState('');
  const [paidIds, setPaidIds] = useState({}); // id -> "already paid offline"
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let alive = true;
    setRequests(null);
    setLoadError('');

    async function load() {
      try {
        const res = await fetch(`/api/admin/enrollment-requests?status=${filter}`);
        if (!res.ok) throw new Error('Could not load the request queue.');
        const json = await res.json();
        if (!alive) return;
        setRequests(json.requests || []);
        setPendingCount(json.pendingCount ?? 0);
      } catch (err) {
        if (!alive) return;
        setRequests([]);
        setLoadError(err.message || 'Could not load the request queue.');
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [filter, reloadKey]);

  async function decide(request, body) {
    if (busyId) return;
    setBusyId(request.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/enrollment-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // A 409 means the queue went stale under us — the student was placed by
        // hand, the class filled up, or another admin already decided this one.
        // Show what the server said and reload rather than let anyone act twice.
        setMsg({ type: 'err', text: data.error || 'That did not go through.' });
        setDeclining('');
        setReloadKey((k) => k + 1);
        return;
      }

      if (data.status === 'declined') {
        setMsg({
          type: 'ok',
          text: `Declined — ${request.studentName} was not placed in ${request.class.name}.`,
        });
      } else if (data.invoice) {
        setMsg({
          type: 'ok',
          text: `Approved. Invoice ${data.invoice.number} for ${money(data.invoice.subtotalCents)} is now waiting in the family's portal.`,
        });
      } else {
        setMsg({ type: 'ok', text: data.invoiceNote || 'Approved.' });
      }

      setDeclining('');
      setReason('');
      setReloadKey((k) => k + 1);
    } catch {
      setMsg({ type: 'err', text: 'Network trouble — nothing was saved. Try again.' });
    } finally {
      setBusyId('');
    }
  }

  const loading = requests === null;
  const list = requests || [];
  const pending = list.filter((r) => r.status === 'pending');
  const decided = list.filter((r) => r.status !== 'pending');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Placement requests</h1>
          <p className="lede">
            What instructors have proposed, waiting on the office.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setFilter(key);
                setMsg(null);
                setDeclining('');
              }}
            >
              {label}
              {key === 'pending' && pendingCount ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>
      </div>

      <p className="muted small" style={{ marginTop: 0, marginBottom: '1.1rem' }}>
        Instructors propose a placement (배치) when they think a student is ready for a class.
        Approving one creates the enrollment <em>and</em> raises an invoice the family pays
        themselves in their portal — nobody has to chase them for a check.
      </p>

      {loadError ? <div className="notice err">{loadError}</div> : null}
      {msg ? <div className={`notice ${msg.type}`}>{msg.text}</div> : null}

      {loading ? (
        <div className="card">
          <div className="empty">
            <span className="ico">⏳</span>
            <p>Loading the queue…</p>
          </div>
        </div>
      ) : null}

      {!loading && list.length === 0 ? (
        <div className="card">
          <div className="empty">
            <span className="ico">📭</span>
            <p>
              {filter === 'pending'
                ? 'Nothing waiting. Instructors will show up here as they propose placements.'
                : `No ${filter} requests yet.`}
            </p>
          </div>
        </div>
      ) : null}

      {/* Pending requests get the full treatment: everything the office needs to
          say yes or no without opening another tab. */}
      {pending.map((r) => {
        const busy = busyId === r.id;
        const free = !r.class.priceCents;
        const alreadyPaid = paidIds[r.id] === true;

        return (
          <div className="card" key={r.id}>
            <div className="card-head">
              <h2>{r.studentName}</h2>
              <span className="small muted">
                asked by {r.tutorName || 'an instructor'} · <LocalTime iso={r.createdAt} />
              </span>
            </div>

            <div className="grid-2">
              <div>
                <div className="strong">{r.class.name}</div>
                <div className="muted small">
                  {[r.class.schedule, termLabel(r.class.quarter)].filter(Boolean).join(' · ') ||
                    'Schedule not set'}
                </div>
              </div>
              <div>
                <div className="strong">{r.family.name}</div>
                <div className="muted small">
                  {r.family.email ? (
                    <a href={`mailto:${r.family.email}`}>{r.family.email}</a>
                  ) : (
                    'No email on file'
                  )}
                </div>
              </div>
            </div>

            {r.note ? (
              <div className="row" style={{ marginTop: '0.9rem' }}>
                <div className="main">
                  <div className="muted small">Instructor&rsquo;s note (메모)</div>
                  <div>{r.note}</div>
                </div>
              </div>
            ) : null}

            {free ? (
              <div className="notice warn" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
                <strong>{r.class.name}</strong> has no price set, so approving this will seat the
                student but <strong>will not</strong> raise an invoice. Set the tuition in the{' '}
                <a href="/admin/classes">class catalog</a> first if the family should be billed.
              </div>
            ) : (
              <div className="row" style={{ marginTop: '0.9rem' }}>
                <div className="main">
                  <div className="strong">Tuition to bill (수업료)</div>
                  <div className="muted small">
                    {alreadyPaid
                      ? 'Marked paid offline — no invoice will go out.'
                      : "Approving raises this as an invoice in the family's portal."}
                  </div>
                </div>
                <div className="meta strong nowrap">{money(r.class.priceCents)}</div>
              </div>
            )}

            {declining === r.id ? (
              // A reason lives on the record forever, so it gets a real textarea
              // rather than a prompt the instructor can never read back.
              <div className="field" style={{ marginTop: '1rem', marginBottom: 0 }}>
                <label htmlFor={`reason-${r.id}`}>Why are you declining? (사유)</label>
                <textarea
                  id={`reason-${r.id}`}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Class is full — put her on the waitlist for winter."
                />
                <div className="hint">
                  Saved on the request so the instructor knows what happened.
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy || !reason.trim()}
                    onClick={() => decide(r, { action: 'decline', reason: reason.trim() })}
                  >
                    {busy ? 'Declining…' : 'Confirm decline'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => {
                      setDeclining('');
                      setReason('');
                    }}
                  >
                    Never mind
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem 1rem',
                  flexWrap: 'wrap',
                  marginTop: '1rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  disabled={busy}
                  onClick={() => decide(r, { action: 'approve', markPaid: alreadyPaid })}
                >
                  {busy ? 'Approving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setDeclining(r.id);
                    setReason('');
                    setMsg(null);
                  }}
                >
                  Decline
                </button>
                {/* Deliberately outside .field: the portal's form styles stretch
                    every input to full width, which a checkbox should not be. */}
                <label
                  className="small muted"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={alreadyPaid}
                    disabled={busy}
                    onChange={(e) =>
                      setPaidIds((prev) => ({ ...prev, [r.id]: e.target.checked }))
                    }
                  />
                  Already paid (Zelle/cash) — skip the invoice
                </label>
              </div>
            )}
          </div>
        );
      })}

      {/* Anything already decided is history: enough to answer "what happened to
          that request?" and nothing more. */}
      {decided.length > 0 ? (
        <div className="card">
          <div className="card-head">
            <h2>{filter === 'declined' ? 'Declined' : 'Decided'}</h2>
          </div>
          <div className="stack">
            {decided.map((r) => (
              <div className="row" key={r.id}>
                <div className="main">
                  <div className="strong">
                    {r.studentName} — {r.class.name}
                  </div>
                  <div className="meta">
                    {r.family.name} · asked by {r.tutorName || 'an instructor'}
                    {r.decidedAt ? (
                      <>
                        {' · '}
                        {r.status} <LocalTime iso={r.decidedAt} format="date" />
                        {r.decidedBy ? ` by ${r.decidedBy}` : ''}
                      </>
                    ) : null}
                  </div>
                  {r.status === 'declined' && r.declineReason ? (
                    <div className="meta">Reason: {r.declineReason}</div>
                  ) : null}
                </div>
                <span className={statusPill(r.status)}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
