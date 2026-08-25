'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';

// Reusable card / bank-transfer panel for the portal. Mirrors the deferred-intent
// flow the shop checkout uses: mount a Payment Element for a known amount, ask
// the server to create the PaymentIntent when the parent hits pay, then confirm
// with the client secret it returns. The server re-derives the amount, so what
// is passed here only decides what the Element renders.
//
// Props:
//   amountCents        what will be charged
//   methods            Stripe payment_method_types, e.g. ['card'] or
//                      ['us_bank_account']. Must match what the server route
//                      creates the intent with, or Stripe rejects the confirm.
//   createIntent       async () => ({ clientSecret }); throw with a message
//   returnUrl          absolute-path Stripe redirects back to
//   label, disabled, onError
export default function PayPanel({
  amountCents,
  methods = ['card'],
  createIntent,
  returnUrl,
  label = 'Pay now',
  disabled = false,
  onError,
}) {
  const [scriptReady, setScriptReady] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const elementRef = useRef(null);

  // One mount point per panel instance, so two panels on a page cannot fight
  // over the same DOM id.
  const domId = 'pay-el-' + useId().replace(/:/g, '');
  const methodKey = methods.join(',');

  const fail = useCallback(
    (msg) => {
      setError(msg);
      if (onError) onError(msg);
    },
    [onError],
  );

  // Remount whenever the method set changes: an Element created for cards cannot
  // be reused to collect bank details, and Stripe will not let you update
  // paymentMethodTypes in place.
  useEffect(() => {
    if (!scriptReady || !amountCents) return undefined;
    let cancelled = false;
    setElementReady(false);

    (async () => {
      try {
        const res = await fetch('/api/config/stripe-key');
        const { publishableKey } = await res.json();
        if (cancelled) return;
        if (!publishableKey) {
          fail('Online payments are not switched on yet. Please contact the school to settle this.');
          return;
        }
        // eslint-disable-next-line no-undef
        const stripe = Stripe(publishableKey);
        stripeRef.current = stripe;

        const elements = stripe.elements({
          mode: 'payment',
          amount: amountCents,
          currency: 'usd',
          paymentMethodTypes: methodKey.split(','),
          appearance: { theme: 'stripe', variables: { colorPrimary: '#6b5b47' } },
        });
        elementsRef.current = elements;

        const el = elements.create('payment');
        elementRef.current = el;
        el.mount('#' + domId);
        el.on('ready', () => {
          if (!cancelled) setElementReady(true);
        });
      } catch {
        if (!cancelled) fail('Payment system unavailable. Please try again.');
      }
    })();

    return () => {
      cancelled = true;
      if (elementRef.current) {
        try {
          elementRef.current.unmount();
        } catch {
          /* already gone */
        }
        elementRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, methodKey, domId, fail]);

  // Amount can change without changing the method (switching package), and that
  // the Element does support in place.
  useEffect(() => {
    if (elementsRef.current && amountCents) {
      try {
        elementsRef.current.update({ amount: amountCents });
      } catch {
        /* the remount effect will rebuild it */
      }
    }
  }, [amountCents]);

  async function pay() {
    if (busy || disabled) return;
    setError('');
    setBusy(true);
    try {
      const { error: submitError } = await elementsRef.current.submit();
      if (submitError) throw new Error(submitError.message);

      const { clientSecret } = await createIntent();
      if (!clientSecret) throw new Error('Could not start the payment.');

      const { error: confirmError } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        clientSecret,
        confirmParams: { return_url: window.location.origin + returnUrl },
      });
      if (confirmError) throw new Error(confirmError.message);
    } catch (err) {
      fail(err.message || 'Payment failed. Please try again.');
      setBusy(false);
    }
  }

  const isBank = methodKey.includes('us_bank_account');

  return (
    <>
      <Script src="https://js.stripe.com/v3/" onLoad={() => setScriptReady(true)} />
      <div id={domId} style={{ marginTop: '0.4rem', minHeight: 44 }} />
      {error ? (
        <p className="notice err" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginTop: '1rem' }}
        disabled={disabled || busy || !elementReady}
        onClick={pay}
      >
        {busy ? 'Processing…' : !elementReady ? 'Loading payment…' : label}
      </button>
      <p className="muted small" style={{ textAlign: 'center', marginTop: '0.6rem', marginBottom: 0 }}>
        {isBank
          ? 'Bank transfers take 3–5 business days to clear. Secured by Stripe.'
          : 'Secured by Stripe. Dotori School never sees your card number.'}
      </p>
    </>
  );
}
