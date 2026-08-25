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
//   saveCard           true when the intent is created with setup_future_usage,
//                      i.e. a monthly plan whose later payments run off-session.
//                      In deferred-intent mode EVERY such option has to be
//                      mirrored here; Stripe compares them at confirm and
//                      refuses on any mismatch.
//   createIntent       async () => ({ clientSecret }); throw with a message
//   returnUrl          absolute-path Stripe redirects back to
//   label, disabled, onError
export default function PayPanel({
  amountCents,
  methods = ['card'],
  saveCard = false,
  createIntent,
  returnUrl,
  label = 'Pay now',
  disabled = false,
  onError,
}) {
  // Seeded from window: next/script will not re-fire onLoad for a second panel
  // on the same page, because the tag is already in the DOM. Relying on onLoad
  // alone left every panel after the first stuck on "Loading payment…".
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== 'undefined' && Boolean(window.Stripe),
  );
  const [elementReady, setElementReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Bumping this remounts the Element, which is the only useful retry when the
  // card form fails to appear.
  const [attempt, setAttempt] = useState(0);
  const [stalled, setStalled] = useState(false);

  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const elementRef = useRef(null);

  // One mount point per panel instance, so two panels on a page cannot fight
  // over the same DOM id.
  const domId = 'pay-el-' + useId().replace(/:/g, '');
  // Any option baked into the Element needs a remount when it changes, because
  // Stripe will not let paymentMethodTypes or setupFutureUsage be updated in
  // place on an existing Element.
  const methodKey = methods.join(',') + (saveCard ? '|save' : '');

  // Belt and braces: if the tag is present but still downloading when this panel
  // mounts, neither onLoad nor the initial check fires, so watch for the global.
  useEffect(() => {
    if (scriptReady) return undefined;
    const t = setInterval(() => {
      if (typeof window !== 'undefined' && window.Stripe) {
        setScriptReady(true);
        clearInterval(t);
      }
    }, 250);
    return () => clearInterval(t);
  }, [scriptReady]);

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
          paymentMethodTypes: methods,
          ...(saveCard ? { setupFutureUsage: 'off_session' } : {}),
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
  }, [scriptReady, methodKey, domId, fail, attempt]);

  // Stripe's card form is an iframe from js.stripe.com and m.stripe.network. A
  // privacy extension or a corporate network that blocks either one leaves the
  // Element mounted but silent — it simply never fires 'ready'. Without this the
  // parent stares at a disabled "Loading payment…" button with no way forward,
  // so after a grace period say what is probably wrong and offer a retry.
  useEffect(() => {
    if (elementReady) {
      setStalled(false);
      return undefined;
    }
    const t = setTimeout(() => setStalled(true), 12000);
    return () => clearTimeout(t);
  }, [elementReady, attempt]);

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

      {stalled && !elementReady && !error ? (
        <div className="notice warn" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
          <strong>The card form did not load.</strong> This is almost always an ad blocker or
          privacy extension blocking <code>js.stripe.com</code>. Allow it for this site, or try a
          different browser.
          <div style={{ marginTop: '0.6rem' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setStalled(false);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        </div>
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
