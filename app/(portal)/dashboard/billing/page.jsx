'use client';

import { useEffect, useState } from 'react';

import LocalTime from '../../LocalTime';

// Enrollments, credit packs and store orders all land in one history, so the
// status vocabulary is the union of three models. Anything we don't recognise
// still gets a readable neutral pill rather than a blank cell.
function pillClass(status) {
  if (status === 'paid') return 'pill ok';
  if (status === 'pending') return 'pill warn';
  if (status === 'refunded') return 'pill mute';
  if (status === 'failed') return 'pill err';
  return 'pill info';
}

function money(cents) {
  const c = cents || 0;
  return '$' + (c / 100).toLocaleString('en-US', {
    minimumFractionDigits: c % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export default function BillingPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch('/api/family/billing');
        if (!res.ok) throw new Error('Could not load your payment history.');
        const json = await res.json();
        if (alive) setData(json);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load your payment history.');
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const loading = !data && !error;
  const items = data?.items || [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Billing</h1>
          <p className="lede">Every payment on your family account, in one place.</p>
        </div>
      </div>

      {error ? <div className="notice err">{error}</div> : null}

      <div className="grid" style={{ marginBottom: '1.1rem' }}>
        <div className="stat">
          <div className="label">Total paid</div>
          {/* The skeleton keeps the same box height as the real value so the
              page doesn't jump once the fetch lands. */}
          <div className="value">{loading || error ? '—' : money(data?.paidCents)}</div>
          <div className="hint">Across classes, session credits and the store</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Payment history</h2>
        </div>

        {!loading && !error && items.length === 0 ? (
          <div className="empty">
            <span className="ico">🧾</span>
            <p>Nothing has been billed yet. Class enrollments, session credit packs and store orders will show up here as soon as you make your first payment.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th className="num" style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="muted small">
                      Loading your payment history…
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="nowrap">
                        {/* An offline record can land without a date; don't
                            hand LocalTime an undefined ISO string. */}
                        {item.at ? <LocalTime iso={item.at} format="date" /> : <span className="muted">—</span>}
                      </td>
                      <td>{item.kind}</td>
                      <td>
                        <div>{item.description}</div>
                        {item.detail ? <div className="muted small">{item.detail}</div> : null}
                      </td>
                      <td className="num">{money(item.amountCents)}</td>
                      <td>
                        <span className={pillClass(item.status)}>{item.status || 'unknown'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted small" style={{ marginTop: '1rem', marginBottom: 0 }}>
          Card receipts are emailed to you by Stripe. Anything paid offline by Zelle appears
          here only once the school records it, so give us a day before checking again.
        </p>
      </div>
    </>
  );
}
