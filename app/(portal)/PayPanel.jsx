'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

// Reusable card-payment panel for the portal. Mirrors the deferred-intent flow
// the shop checkout already uses: mount a Payment Element for a known amount,
// then ask the server to create the PaymentIntent at the moment the parent hits
// pay, and confirm with the client secret it returns.
//
// Props:
//   amountCents  what we will charge (drives the Element, server re-derives it)
//   createIntent async () => ({ clientSecret }) — must throw with a message on failure
//   returnUrl    absolute-path Stripe redirects back to after 3-D Secure
//   label        button text
//   disabled     block payment while the caller's own form is incomplete
export default function PayPanel({
  amountCents,
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
  const mountedRef = useRef(false);

  const fail = useCallback(
    (msg) => {
      setError(msg);
      if (onError) onError(msg);
    },
    [onError],
  );

  useEffect(() => {
    if (!scriptReady || mountedRef.current || !amountCents) return;
    mountedRef.current = true;

    (async () => {
      try {
        const res = await fetch('/api/config/stripe-key');
        const { publishableKey } = await res.json();
        if (!publishableKey) {
          fail('Card payments are not configured yet. Please contact the school.');
          return;
        }
        // eslint-disable-next-line no-undef
        const stripe = Stripe(publishableKey);
        stripeRef.current = stripe;

        const elements = stripe.elements({
          mode: 'payment',
          amount: amountCents,
          currency: 'usd',
          appearance: { theme: 'stripe', variables: { colorPrimary: '#6b5b47' } },
        });
        elementsRef.current = elements;

        const el = elements.create('payment');
        el.mount('#portal-payment-element');
        el.on('ready', () => setElementReady(true));
      } catch {
        fail('Payment system unavailable. Please try again.');
      }
    })();
  }, [scriptReady, amountCents, fail]);

  // The Element is created with an amount; if the caller switches package the
  // amount has to be pushed into it or Stripe will charge against the old one.
  useEffect(() => {
    if (elementsRef.current && amountCents) {
      elementsRef.current.update({ amount: amountCents });
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

  return (
    <>
      <Script src="https://js.stripe.com/v3/" onLoad={() => setScriptReady(true)} />
      <div id="portal-payment-element" style={{ marginTop: '0.4rem', minHeight: 44 }} />
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
        Secured by Stripe. Dotori School never sees your card number.
      </p>
    </>
  );
}
