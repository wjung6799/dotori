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

// What Stripe calls each method when the Payment Element is built. Must match
// what the pay route creates the intent with, or the confirm is refused.
const METHOD_TYPES = { card: ['card'], ach: ['us_bank_account'] };

export default function BillingPage() {
  const [invoiceData, setInvoiceData] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  // 'ok' | 'pending' | 'attention' — what the return from Stripe actually said,
  // not a blanket success: an ACH confirm comes back 'processing', and a
  // microdeposit verification or a decline must not be congratulated.
  const [returnStatus, setReturnStatus] = useState('');

  // Only one invoice may have a Payment Element mounted at a time — Stripe gives
  // us one Element per set of payment_method_types, and two live panels fight
  // over the same confirm. `activeId` is the single open panel.
  const [activeId, setActiveId] = useState('');
  // Chosen method per invoice. Bank transfer is the default because it is the
  // cheaper option for the family; picking it should never be the extra step.
  const [methodById, setMethodById] = useState({});

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
    const q = new URLSearchParams(window.location.search);
    if (q.get('paid') !== '1') return undefined;
    const rs = q.get('redirect_status');
    setReturnStatus(!rs || rs === 'succeeded' ? 'ok' : rs === 'processing' ? 'pending' : 'attention');
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [load]);

  const loading = !invoiceData && !history && !error;

  const invoices = invoiceData?.invoices || [];
  const savingsHint = invoiceData?.savingsHint || '';
  const outstandingCents = invoiceData?.outstandingCents ?? 0;

  const payable = invoices.filter((inv) => inv.status === 'open' || inv.status === 'processing');
  const openCount = invoices.filter((inv) => inv.status === 'open').length;

  // Paid invoices belong in the history alongside enrollments, credits and store
  // orders. The billing route does not list invoices itself, so they are folded
  // in here and the whole list re-sorted by date.
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');

  // ...but it DOES list the class enrollment the invoice was raised for, and the
  // webhook settles both in the same breath. Drop the enrollment row an invoice
  // supersedes, or the family sees the same payment listed twice.
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

  // ACH is the default because it is the fee-free option; picking the cheaper
  // way to pay should never be the extra step.
  const methodFor = (id) => methodById[id] || 'ach';

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

      {returnStatus === 'ok' ? (
        <div className="notice ok">
          <strong>Your payment went through — thank you.</strong> A card payment shows as paid
          within a few seconds. This page refreshes itself in a moment.
        </div>
      ) : null}
      {returnStatus === 'pending' ? (
        <div className="notice info">
          <strong>Your bank transfer is on its way.</strong> It takes 3–5 business days to clear;
          the invoice shows as processing until the money lands, and nothing more is needed from
          you.
        </div>
      ) : null}
      {returnStatus === 'attention' ? (
        <div className="notice warn">
          <strong>That payment did not finish.</strong> If you chose to verify your bank account
          with micro-deposits, follow the instructions Stripe emailed you and the payment completes
          from there. Otherwise the invoice below is still open — you can simply try again.
        </div>
      ) : null}

      {error ? <div className="notice err">{error}</div> : null}

      {/* ── The number that matters ──────────────────────────────────────── */}
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
        const chargeCents = quote.totalCents;

        return (
          <div className="card" key={inv.id}>
            <div className="card-head">
              <h2>{inv.number}</h2>
              <span
                className={isOpen ? (overdue ? 'pill err' : 'pill warn') : 'pill info'}
              >
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
                  // A card can be declined days after the family thought they
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

                {/* Only worth showing when a fee moves the number: with no
                    adjustment it just repeats the Subtotal row above. */}
                {quote.adjustmentCents ? (
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
                ) : null}

                {!isActive ? (
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => choose(inv.id, 'ach')}
                    >
                      {'Pay ' + money((inv.quotes?.ach || quote).totalCents) + ' by bank transfer'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => choose(inv.id, 'card')}
                    >
                      {'Pay ' + money((inv.quotes?.card || quote).totalCents) + ' by card'}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: '1.25rem' }}>
                    <p className="strong" style={{ margin: '0 0 0.15rem' }}>
                      Paying {money(chargeCents)} by {METHOD_LABEL[method]}
                    </p>
                    <p className="muted small" style={{ margin: '0 0 0.6rem' }}>
                      {method === 'ach'
                        ? 'Your bank account is debited now. Transfers take 3–5 business days to clear, and the invoice shows as processing until the money lands.'
                        : 'Your card is charged now and the invoice is marked paid within seconds.'}
                    </p>
                    {/* Keyed on the method as well as the invoice: the Element
                        is built for one method set and one amount, so switching
                        either has to build a fresh panel rather than reuse the
                        last one. */}
                    <PayPanel
                      key={inv.id + ':' + method}
                      amountCents={chargeCents}
                      methods={METHOD_TYPES[method]}
                      createIntent={createIntentFor(inv.id, method)}
                      returnUrl="/dashboard/billing?paid=1"
                      label={'Pay ' + money(chargeCents)}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: '0.7rem' }}
                      onClick={() => choose(inv.id, method === 'ach' ? 'card' : 'ach')}
                    >
                      {method === 'ach'
                        ? 'Pay by card instead (' + money((inv.quotes?.card || quote).totalCents) + ')'
                        : 'Pay by bank transfer instead (' + money((inv.quotes?.ach || quote).totalCents) + ')'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              // A bank transfer still clearing.
              <div className="notice info" style={{ margin: '1rem 0 0' }}>
                <strong>We have your {METHOD_LABEL[inv.paymentMethod] || 'payment'} for {money(inFlightCents)}.</strong>{' '}
                Bank transfers take 3–5 business days to clear. Nothing more is needed from you — the
                invoice flips to paid on its own. If the bank turns the transfer back, the invoice
                reopens here with what went wrong so you can pay another way.
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
