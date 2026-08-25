'use client';

import { useCallback, useEffect, useState } from 'react';

import LocalTime from '../../LocalTime';

// Everything server-side is integer cents; never let a dollar float near it.
function money(cents) {
  const c = cents || 0;
  return '$' + (c / 100).toLocaleString('en-US', {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// open = the family still owes it · processing = a bank debit (ACH) is clearing
// and is NOT money in hand yet · paid = settled · void = cancelled.
function statusPill(status) {
  if (status === 'paid') return 'pill ok';
  if (status === 'processing') return 'pill info';
  if (status === 'void') return 'pill mute';
  if (status === 'open') return 'pill warn';
  return 'pill info';
}

const FILTERS = [
  ['all', 'All invoices'],
  ['open', 'Open'],
  ['processing', 'Clearing'],
  ['paid', 'Paid'],
  ['void', 'Void'],
];

// This page lives behind middleware.js, which already turns away anyone who is
// not an admin — so the component only has to worry about the data.
export default function AdminInvoicesPage() {
  const [data, setData] = useState(null); // null = first load not finished
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async (which) => {
    try {
      const qs = which && which !== 'all' ? `?status=${encodeURIComponent(which)}` : '';
      const res = await fetch(`/api/admin/invoices${qs}`);
      if (!res.ok) throw new Error('Could not load invoices.');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setData({ invoices: [], totals: {} });
      setError(err.message || 'Could not load invoices.');
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [load, status]);

  async function act(invoice, action) {
    if (busyId) return;

    let note = '';
    if (action === 'mark_paid') {
      // Marking paid by hand moves real money in the books, so make the office
      // read the family's name and the amount before it happens.
      const ok = window.confirm(
        `Mark ${invoice.number} as paid?\n\n${invoice.family} — ${money(invoice.subtotalCents)}\n\n` +
          'Use this only for Zelle or cash the school has actually received.',
      );
      if (!ok) return;
    } else if (action === 'void') {
      const reason = window.prompt(
        `Void ${invoice.number} for ${invoice.family}?\n\nReason (optional — saved on the invoice):`,
        '',
      );
      if (reason === null) return; // Cancel, not an empty reason.
      note = reason.trim();
    }

    setBusyId(invoice.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note ? { action, note } : { action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'That change did not go through.');
      await load(status);
    } catch (err) {
      setError(err.message || 'That change did not go through.');
    } finally {
      setBusyId('');
    }
  }

  const loading = data === null;
  const invoices = data?.invoices || [];
  const totals = data?.totals || {};

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p className="lede">
            Everything the school has billed (청구서) — what is still owed, what is clearing, and
            what has landed.
          </p>
        </div>
      </div>

      {error ? <div className="notice err">{error}</div> : null}

      <div className="grid" style={{ marginBottom: '1.1rem' }}>
        <div className="stat">
          <div className="label">Outstanding</div>
          {/* Dashes rather than zeros while loading: a real $0 and an unknown
              should not look the same to the office. */}
          <div className="value">{loading ? '—' : money(totals.outstandingCents)}</div>
          <div className="hint">Open invoices families still owe</div>
        </div>
        <div className="stat">
          <div className="label">Clearing</div>
          <div className="value">{loading ? '—' : money(totals.processingCents)}</div>
          <div className="hint">Bank transfers in flight — 3–5 business days, not paid yet</div>
        </div>
        <div className="stat">
          <div className="label">Collected</div>
          <div className="value">{loading ? '—' : money(totals.collectedCents)}</div>
          <div className="hint">Actually received on paid invoices</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>All invoices</h2>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter invoices by status"
          >
            {FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {!loading && invoices.length === 0 ? (
          <div className="empty">
            <span className="ico">🧾</span>
            <p>
              Nothing here. Invoices are raised when the office assigns an unpaid seat, so this
              list fills up as classes are staffed.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Family</th>
                  {/* table.data only right-aligns td.num, so the header needs
                      the alignment spelled out inline. */}
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Issued / due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="muted small">
                      Loading invoices…
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const busy = busyId === inv.id;
                    // act() refuses to start while ANY row is saving, so every
                    // row's controls have to go dead too — otherwise the other
                    // buttons still look live and swallow the click in silence.
                    const locked = Boolean(busyId);
                    // A settled invoice can differ from its subtotal: paying by
                    // bank transfer earns a discount, so show what really came in.
                    const collectedDiffers =
                      inv.status === 'paid' &&
                      typeof inv.totalPaidCents === 'number' &&
                      inv.totalPaidCents !== inv.subtotalCents;

                    return (
                      <tr key={inv.id}>
                        <td>
                          <div className="strong nowrap">{inv.number}</div>
                          {inv.studentName ? (
                            <div className="muted small">{inv.studentName}</div>
                          ) : null}
                        </td>
                        <td>
                          <div>{inv.family}</div>
                          {inv.email ? <div className="muted small">{inv.email}</div> : null}
                        </td>
                        <td className="num">
                          <div>{money(inv.subtotalCents)}</div>
                          {collectedDiffers ? (
                            <div className="muted small">paid {money(inv.totalPaidCents)}</div>
                          ) : null}
                        </td>
                        <td>
                          <div className="nowrap">
                            {inv.issuedAt ? (
                              <LocalTime iso={inv.issuedAt} format="date" />
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                          {inv.dueAt ? (
                            <div className="muted small nowrap">
                              due <LocalTime iso={inv.dueAt} format="date" />
                            </div>
                          ) : null}
                          {inv.overdue ? (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span className="pill err">Overdue</span>
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span className={statusPill(inv.status)}>{inv.status}</span>
                          {inv.lastPaymentError ? (
                            <div className="muted small">{inv.lastPaymentError}</div>
                          ) : null}
                        </td>
                        <td>
                          {inv.status === 'open' ? (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={locked}
                                onClick={() => act(inv, 'mark_paid')}
                              >
                                {busy ? 'Saving…' : 'Mark paid'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={locked}
                                onClick={() => act(inv, 'void')}
                              >
                                Void
                              </button>
                            </div>
                          ) : null}

                          {/* No hand-settling while a debit is in flight: if it
                              later fails, the school would count the money twice. */}
                          {inv.status === 'processing' ? (
                            <span className="muted small">clearing</span>
                          ) : null}

                          {inv.status === 'void' ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={locked}
                              onClick={() => act(inv, 'reopen')}
                            >
                              {busy ? 'Saving…' : 'Reopen'}
                            </button>
                          ) : null}

                          {inv.status === 'paid' ? (
                            <span className="muted small nowrap">
                              {inv.paidAt ? <LocalTime iso={inv.paidAt} format="date" /> : 'settled'}
                              {inv.paymentMethod ? ` · ${inv.paymentMethod}` : ''}
                            </span>
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
          Families pay their own invoices in the portal. Mark one paid by hand only for Zelle or
          cash — a card or bank payment settles itself.
        </p>
      </div>
    </>
  );
}
