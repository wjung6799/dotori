'use client';

import { useCallback, useEffect, useState } from 'react';

import LocalTime from '../../LocalTime';
import PayPanel from '../../PayPanel';

// Billing leads with what the family can act on — invoices the office raised for
// assigned seats — and keeps the combined payment history underneath. Families
// never sign themselves up for a class, so an invoice is the first they hear of
// a charge; it has to be the first thing on the page.

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

const METHOD_LABEL = { ach: 'bank transfer (ACH)', card: 'card', offline: 'Zelle or check' };

// Card is the only method the online channel offers — see ONLINE_METHODS in
// lib/pricing.js. Anyone who would rather not pay the fee uses Zelle or a check.
const ONLINE_METHOD = 'card';

export default function BillingPage() {
  const [invoiceData, setInvoiceData] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [justPaid, setJustPaid] = useState(false);

  // Only one invoice may have a Payment Element mounted at a time — Stripe gives
  // us one Element per set of payment_method_types, and two live panels fight
  // over the same confirm. `activeId` is the single open panel.
  const [activeId, setActiveId] = useState('');
  // Chosen method per invoice. Bank transfer is the default because it is the
  // cheaper option for the family; picking it should never be the extra step.
  const [methodById, setMethodById] = useState({});
  // Per-invoice busy flag, so splitting one bill does not blank the whole page.
  const [splitting, setSplitting] = useState({});

  const load = useCallback(async () => {
    const [invRes, histRes] = await Promise.allSettled([
      fetch('/api/family/invoices', { cache: 'no-store' }),
      fetch('/api/family/billing', { cache: 'no-store' }),
    ]);

    let failed = false;

    if (invRes.status === 'fulfilled' && invRes.value.ok) {
      setInvoiceData(await invRes.value.json());
    } else {
      failed = true;
    }

    if (histRes.status === 'fulfilled' && histRes.value.ok) {
      setHistory(await histRes.value.json());
    } else {
      failed = true;
    }

    // One notice covers both fetches: a family cannot act on which half failed,
    // and a half-loaded page is still worth showing.
    setError(failed ? 'Some of your billing information would not load just now. Please refresh the page.' : '');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Coming back from Stripe. useSearchParams would need a Suspense boundary at
  // build time, so read the query string here instead. The webhook — not this
  // page — settles the invoice, so re-read once and the page usually self-heals.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('paid') !== '1') return undefined;
    setJustPaid(true);
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [load]);

  const loading = !invoiceData && !history && !error;

  const invoices = invoiceData?.invoices || [];
  const savingsHint = invoiceData?.savingsHint || '';
  const outstandingCents = invoiceData?.outstandingCents ?? 0;
  const paidCents = history?.paidCents ?? 0;

  const payable = invoices.filter((inv) => inv.status === 'open' || inv.status === 'processing');
  const openCount = invoices.filter((inv) => inv.status === 'open').length;

  // Paid invoices belong in the history alongside enrollments, credits and store
  // orders. The billing route does not list invoices itself, so they are folded
  // in here and the whole list re-sorted by date.
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');

  // ...but it DOES list the class enrollment the invoice was raised for, and the
  // webhook settles both in the same breath. Drop the enrollment row an invoice
  // supersedes, or the family sees one payment twice and the rows no longer add
  // up to the "Total paid" figure above.
  const supersededIds = new Set(
    paidInvoices.filter((inv) => inv.enrollmentId).map((inv) => 'enr-' + inv.enrollmentId),
  );

  const invoiceRows = paidInvoices
    .map((inv) => ({
      id: 'inv-' + inv.number,
      kind: 'Invoice',
      description: inv.number + (inv.studentName ? ' — ' + inv.studentName : ''),
      detail: (inv.items || []).map((i) => i.description).filter(Boolean).join(' · '),
      amountCents: inv.totalPaidCents || inv.quotes?.[inv.paymentMethod]?.totalCents || inv.subtotalCents,
      status: 'paid',
      at: inv.paidAt || inv.issuedAt,
    }));

  const items = [
    ...(history?.items || []).filter((i) => !supersededIds.has(i.id)),
    ...invoiceRows,
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  const methodFor = () => ONLINE_METHOD;

  function choose(id, method) {
    // Tapping the method that is already live collapses the panel, so a family
    // who changed their mind is not stuck with a card sheet on screen.
    if (activeId === id && methodFor(id) === method) {
      setActiveId('');
      return;
    }
    setMethodById((prev) => ({ ...prev, [id]: method }));
    setActiveId(id);
  }

  async function splitInto(invoiceId, installments) {
    setSplitting((prev) => ({ ...prev, [invoiceId]: true }));
    setError('');
    try {
      const res = await fetch(`/api/family/invoices/${invoiceId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installments }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not set up the payment plan.');
      // The original invoice is now void and N new ones exist, so reload rather
      // than patching the list in place.
      setActiveId('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSplitting((prev) => ({ ...prev, [invoiceId]: false }));
    }
  }

  function createIntentFor(invoiceId, method) {
    return async () => {
      const res = await fetch('/api/family/invoices/' + invoiceId + '/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.clientSecret) {
        // A 503 here means Stripe was never connected; the route already says so
        // in plain English. Throwing it puts the message in PayPanel's own error
        // notice, and the invoice stays on screen so the family can call us.
        throw new Error(payload.error || 'Could not start the payment. Please try again.');
      }
      return payload;
    };
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Billing</h1>
          <p className="lede">What you owe, and every payment on your family account. (청구)</p>
        </div>
      </div>

      {justPaid ? (
        <div className="notice ok">
          <strong>Your payment went through — thank you.</strong> A card payment shows as paid within
          a few seconds. A bank transfer takes 3–5 business days to clear, so it will sit as
          “processing” until then. This page refreshes itself in a moment.
        </div>
      ) : null}

      {error ? <div className="notice err">{error}</div> : null}

      {/* ── The two numbers that matter ──────────────────────────────────── */}
      <div className="grid" style={{ marginBottom: '1.1rem' }}>
        <div className="stat">
          <div className="label">Outstanding</div>
          {/* The em dash keeps the box at its real height while loading, so the
              page doesn't jump once the fetch lands. */}
          <div className="value">{invoiceData ? money(outstandingCents) : '—'}</div>
          <div className="hint">
            {!invoiceData
              ? 'Checking your invoices…'
              : openCount === 0
                ? 'Nothing due right now'
                : openCount + (openCount === 1 ? ' invoice' : ' invoices') + ' waiting to be paid'}
          </div>
        </div>
        <div className="stat">
          <div className="label">Total paid</div>
          <div className="value">{history ? money(paidCents) : '—'}</div>
          <div className="hint">Across classes, session credits and the store</div>
        </div>
      </div>

      {/* ── Invoices to pay ──────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Invoices to pay</h2>
        </div>

        {loading ? (
          <div className="empty">
            <span className="ico">🧾</span>
            <p>Loading your invoices…</p>
          </div>
        ) : !invoiceData ? (
          // Same rule as the history below: never say "you owe nothing" when we
          // simply could not read the invoices.
          <div className="empty">
            <span className="ico">🧾</span>
            <p>Your invoices are not available at the moment. Please refresh the page.</p>
          </div>
        ) : payable.length === 0 ? (
          <div className="empty">
            <span className="ico">✅</span>
            <p>
              Nothing to pay right now. When the office assigns your child a class seat, the invoice
              for it appears here and you can settle it yourself.
            </p>
          </div>
        ) : (
          <p className="muted small" style={{ margin: '0 0 0.25rem' }}>
            Class seats are assigned by the school, and each one raises an invoice you pay here.
          </p>
        )}
      </div>

      {payable.map((inv) => {
        const method = methodFor(inv.id);
        const quote = inv.quotes?.[method] || inv.quotes?.card || { totalCents: inv.subtotalCents };
        const isOpen = inv.status === 'open';
        const isActive = activeId === inv.id;
        const overdue = isOpen && inv.dueAt && new Date(inv.dueAt) < new Date();
        // A processing invoice was already quoted at intent time, so show the
        // amount actually in flight rather than the raw subtotal.
        const inFlightCents = inv.quotes?.[inv.paymentMethod]?.totalCents ?? inv.subtotalCents;

        return (
          <div className="card" key={inv.id}>
            <div className="card-head">
              <h2>
                {inv.number}
                {inv.installmentCount ? (
                  <span className="muted small nowrap">
                    {'  ·  Payment ' + inv.installmentNumber + ' of ' + inv.installmentCount}
                  </span>
                ) : null}
              </h2>
              <span className={isOpen ? (overdue ? 'pill err' : 'pill warn') : 'pill info'}>
                {isOpen ? (overdue ? 'overdue' : 'due') : 'processing'}
              </span>
            </div>

            <p className="muted small" style={{ margin: '-0.55rem 0 0.9rem' }}>
              {inv.studentName ? <>For {inv.studentName} · </> : null}
              Issued <LocalTime iso={inv.issuedAt} format="date" />
              {inv.dueAt ? (
                <>
                  {' '}
                  · Due <LocalTime iso={inv.dueAt} format="date" />
                </>
              ) : null}
            </p>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.items || []).length === 0 ? (
                    <tr>
                      <td className="muted small">No line items recorded.</td>
                      <td className="num">{money(inv.subtotalCents)}</td>
                    </tr>
                  ) : (
                    inv.items.map((item, i) => (
                      <tr key={inv.number + '-' + i}>
                        <td>
                          <div>{item.description}</div>
                          {item.detail ? <div className="muted small">{item.detail}</div> : null}
                        </td>
                        <td className="num">{money(item.amountCents)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="strong">Subtotal</td>
                    <td className="num strong">{money(inv.subtotalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {isOpen ? (
              <>
                {inv.lastPaymentError ? (
                  // A bank debit can bounce days after the family thought they
                  // were done. This is the only place they would ever find out.
                  <div className="notice err" style={{ marginTop: '1rem' }}>
                    <strong>Your last payment did not go through.</strong> {inv.lastPaymentError} You
                    can try again below.
                  </div>
                ) : null}

                {savingsHint ? (
                  <p className="muted small" style={{ margin: '1.1rem 0 0.6rem' }}>
                    {savingsHint}
                  </p>
                ) : null}

                {/* One online method, so there is nothing to choose between —
                    just the total, itemised so the fee is never a surprise. */}
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-soft)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1.05rem',
                  }}
                >
                  <div className="row" style={{ background: 'none', border: 0, padding: 0 }}>
                    <span className="main muted small">Tuition</span>
                    <span className="small">{money(inv.subtotalCents)}</span>
                  </div>
                  {quote.adjustmentCents ? (
                    <div className="row" style={{ background: 'none', border: 0, padding: '0.2rem 0 0' }}>
                      <span className="main muted small">{quote.adjustmentLabel}</span>
                      <span className="small">{money(quote.adjustmentCents)}</span>
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
                      {money(quote.totalCents)}
                    </span>
                  </div>
                </div>

                {/* Splitting is offered only on a bill that is not already one
                    instalment of a plan, and only while nothing has been paid. */}
                {!inv.installmentCount && !splitting[inv.id] ? (
                  <p className="muted small" style={{ margin: '0.8rem 0 0' }}>
                    Rather pay monthly?{' '}
                    {[2, 3].map((n, i) => (
                      <span key={n}>
                        {i ? ' · ' : ''}
                        <button
                          type="button"
                          className="link"
                          style={{
                            background: 'none',
                            border: 0,
                            padding: 0,
                            font: 'inherit',
                            color: 'var(--brown-mid)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          onClick={() => splitInto(inv.id, n)}
                        >
                          Split into {n} payments
                        </button>
                      </span>
                    ))}
                    . The total stays {money(quote.totalCents)} — the fee is split too.
                  </p>
                ) : null}
                {splitting[inv.id] ? (
                  <p className="muted small" style={{ margin: '0.8rem 0 0' }}>
                    Setting up your payment plan…
                  </p>
                ) : null}

                {!isActive ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: '1rem' }}
                    onClick={() => choose(inv.id, ONLINE_METHOD)}
                  >
                    Pay {money(quote.totalCents)} by card
                  </button>
                ) : (
                  <div style={{ marginTop: '1.25rem' }}>
                    <p className="strong" style={{ margin: '0 0 0.15rem' }}>
                      Paying {money(quote.totalCents)} by card
                    </p>
                    <p className="muted small" style={{ margin: '0 0 0.6rem' }}>
                      Your card is charged now and the invoice is marked paid within seconds.
                    </p>
                    {/* Keyed so switching invoice builds a clean panel rather than
                        reusing an Element created for the last one. */}
                    <PayPanel
                      key={inv.id + ':' + ONLINE_METHOD}
                      amountCents={quote.totalCents}
                      methods={['card']}
                      createIntent={createIntentFor(inv.id, ONLINE_METHOD)}
                      returnUrl="/dashboard/billing?paid=1"
                      label={'Pay ' + money(quote.totalCents)}
                    />
                  </div>
                )}
              </>
            ) : (
              // Processing: the money is already on its way, so there must be no
              // way to pay it a second time.
              <div className="notice info" style={{ margin: '1rem 0 0' }}>
                <strong>We have your {METHOD_LABEL[inv.paymentMethod] || 'payment'} for {money(inFlightCents)}.</strong>{' '}
                Bank transfers take 3–5 business days to clear. Nothing more is needed from you — the
                invoice flips to paid on its own, and we will email you if the bank turns it back.
              </div>
            )}
          </div>
        );
      })}

      {/* ── History ──────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Payment history</h2>
        </div>

        {!loading && !history ? (
          // The history fetch is the half that failed; the notice at the top of
          // the page says so, and claiming "nothing billed yet" would be a lie.
          <div className="empty">
            <span className="ico">🧾</span>
            <p>Your payment history is not available at the moment. Please refresh the page.</p>
          </div>
        ) : !loading && items.length === 0 ? (
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
                  <th style={{ textAlign: 'right' }}>Amount</th>
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
