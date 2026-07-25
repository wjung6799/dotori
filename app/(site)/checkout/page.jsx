'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';

const checkoutCss = `
.checkout-layout { display:grid; grid-template-columns:1fr 380px; gap:2rem; align-items:start; }
@media(max-width:780px){ .checkout-layout{grid-template-columns:1fr;} .order-summary{order:-1;} }
.section-box { background:#fff; border:1px solid #e8e0d8; border-radius:14px; padding:1.5rem; margin-bottom:1.2rem; }
.section-title { font-weight:700; color:#6b5b47; font-size:1rem; margin:0 0 1rem; }
.finput { width:100%; padding:0.65rem 0.9rem; border:1.5px solid #ddd; border-radius:8px; font-size:0.95rem; box-sizing:border-box; }
.finput:focus { outline:none; border-color:#6b5b47; }
.flabel { display:block; font-weight:600; color:#6b5b47; margin-bottom:0.3rem; font-size:0.88rem; }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; }
.order-item { display:flex; gap:0.8rem; align-items:flex-start; padding:0.7rem 0; border-bottom:1px solid #f5f0eb; }
.order-item img { width:52px; height:52px; object-fit:cover; border-radius:8px; background:#f5f0eb; flex-shrink:0; }
.order-item .no-img-sm { width:52px; height:52px; border-radius:8px; background:#f5f0eb; display:flex; align-items:center; justify-content:center; color:#bbb; font-size:1.3rem; flex-shrink:0; }
.total-row { display:flex; justify-content:space-between; padding:0.45rem 0; font-size:0.9rem; color:#666; }
.total-row.grand { font-weight:700; color:#6b5b47; font-size:1rem; border-top:1px solid #eee; margin-top:0.3rem; padding-top:0.7rem; }
#payment-element { margin-top:0.5rem; }
#card-errors { color:#e00; font-size:0.85rem; margin-top:0.5rem; min-height:1.2em; }
#pay-btn { width:100%; padding:0.85rem; background:#6b5b47; color:#fff; border:none; border-radius:10px; font-weight:700; font-size:1rem; cursor:pointer; margin-top:1rem; }
#pay-btn:disabled { background:#bbb; cursor:not-allowed; }
`;

export default function CheckoutPage() {
  const [cart, setCart] = useState([]);
  const [cartReady, setCartReady] = useState(false);
  const [taxAmount, setTaxAmount] = useState(0);
  const [taxStatus, setTaxStatus] = useState('(enter address)');
  const [payDisabled, setPayDisabled] = useState(true);
  const [payLabel, setPayLabel] = useState('Place Order');
  const [cardError, setCardError] = useState('');
  const [stripeReady, setStripeReady] = useState(false);

  // mutable refs that mirror the original closure variables
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElementRef = useRef(null);
  const calculationIdRef = useRef(null);
  const taxAmountRef = useRef(0);
  const taxDebounceRef = useRef(null);
  const cartRef = useRef([]);
  const mountedRef = useRef(false);

  // form field refs
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const line1Ref = useRef(null);
  const line2Ref = useRef(null);
  const cityRef = useRef(null);
  const stateRef = useRef(null);
  const zipRef = useRef(null);
  const countryRef = useRef(null);

  // Load cart from sessionStorage on mount
  useEffect(() => {
    let loaded = [];
    if (typeof window !== 'undefined') {
      try {
        loaded = JSON.parse(sessionStorage.getItem('dotori_cart') || '[]');
      } catch {
        loaded = [];
      }
    }
    cartRef.current = loaded;
    setCart(loaded);
    setCartReady(true);
  }, []);

  function getSubtotal() {
    return cartRef.current.reduce((s, i) => s + i.price * i.qty, 0);
  }

  function getShipping(subtotal) {
    const threshold = parseFloat('50');
    return subtotal >= threshold ? 0 : 5.99;
  }

  const subtotal = getSubtotal();
  const shipping = getShipping(subtotal);
  const total = subtotal + shipping + taxAmount;

  async function setupStripe() {
    try {
      const keyRes = await fetch('/api/config/stripe-key');
      const { publishableKey } = await keyRes.json();
      // eslint-disable-next-line no-undef
      const stripe = Stripe(publishableKey);
      stripeRef.current = stripe;

      const sub = getSubtotal();
      const ship = getShipping(sub);
      const totalCents = Math.round((sub + ship) * 100); // tax added later

      const elements = stripe.elements({
        mode: 'payment',
        amount: totalCents,
        currency: 'usd',
        appearance: { theme: 'stripe', variables: { colorPrimary: '#6b5b47' } },
      });
      elementsRef.current = elements;

      const paymentElement = elements.create('payment');
      paymentElementRef.current = paymentElement;
      paymentElement.mount('#payment-element');
      paymentElement.on('ready', () => {
        setPayDisabled(false);
      });
    } catch (err) {
      setCardError('Payment system unavailable. Please try again.');
    }
  }

  // Initialize Stripe once the cart is loaded and Stripe.js is ready
  useEffect(() => {
    if (!cartReady || !stripeReady) return;
    if (!cartRef.current.length) return;
    if (mountedRef.current) return;
    mountedRef.current = true;
    setupStripe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartReady, stripeReady]);

  function getAddress() {
    return {
      line1: line1Ref.current.value.trim(),
      line2: line2Ref.current.value.trim(),
      city: cityRef.current.value.trim(),
      state: stateRef.current.value.trim().toUpperCase(),
      zip: zipRef.current.value.trim(),
      country: countryRef.current.value.trim().toUpperCase() || 'US',
    };
  }

  function addressComplete() {
    const a = getAddress();
    return a.line1 && a.city && a.state && a.zip;
  }

  async function estimateTax() {
    if (!addressComplete()) return;
    setTaxStatus('(calculating…)');
    try {
      const sub = getSubtotal();
      const ship = getShipping(sub);
      const address = getAddress();
      const res = await fetch('/api/shop/tax-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartRef.current, address, shippingCost: ship }),
      });
      const data = await res.json();
      taxAmountRef.current = data.taxAmount || 0;
      calculationIdRef.current = data.calculationId || null;
      setTaxStatus('');
      setTaxAmount(taxAmountRef.current);
    } catch (err) {
      setTaxStatus('(unavailable)');
      taxAmountRef.current = 0;
      setTaxAmount(0);
    }
  }

  function handleAddressBlur() {
    clearTimeout(taxDebounceRef.current);
    taxDebounceRef.current = setTimeout(estimateTax, 600);
  }

  async function handlePay() {
    setCardError('');

    const firstName = firstNameRef.current.value.trim();
    const lastName = lastNameRef.current.value.trim();
    const email = emailRef.current.value.trim();
    const address = getAddress();

    if (!firstName || !lastName || !email) {
      setCardError('Please fill in your name and email.');
      return;
    }
    if (!address.line1 || !address.city || !address.state || !address.zip) {
      setCardError('Please complete your shipping address.');
      return;
    }

    setPayDisabled(true);
    setPayLabel('Processing…');

    try {
      const res = await fetch('/api/shop/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartRef.current,
          guest: {
            email,
            firstName,
            lastName,
            phone: phoneRef.current.value.trim(),
            address,
          },
          calculationId: calculationIdRef.current,
          taxAmount: taxAmountRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order.');

      const { error } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        clientSecret: data.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation`,
        },
      });

      if (error) throw new Error(error.message);
    } catch (err) {
      setCardError(err.message);
      setPayDisabled(false);
      setPayLabel('Place Order');
    }
  }

  const isEmpty = cartReady && !cart.length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: checkoutCss }} />
      <Script src="https://js.stripe.com/v3/" onLoad={() => setStripeReady(true)} />

      <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
        <h1 style={{ color: '#6b5b47', fontSize: '1.6rem', marginBottom: '1.5rem' }}>Checkout</h1>

        {isEmpty && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#aaa', fontSize: '1.1rem' }}>Your cart is empty.</p>
            <Link href="/store" style={{ color: '#6b5b47', fontWeight: 700 }}>← Back to Shop</Link>
          </div>
        )}

        {!isEmpty && (
          <div className="checkout-layout">
            {/* Left: forms */}
            <div>
              {/* Contact info */}
              <div className="section-box">
                <p className="section-title">Contact Information</p>
                <div className="form-row" style={{ marginBottom: '0.8rem' }}>
                  <div><label className="flabel">First Name *</label><input type="text" ref={firstNameRef} className="finput" autoComplete="given-name" /></div>
                  <div><label className="flabel">Last Name *</label><input type="text" ref={lastNameRef} className="finput" autoComplete="family-name" /></div>
                </div>
                <div style={{ marginBottom: '0.8rem' }}><label className="flabel">Email *</label><input type="email" ref={emailRef} className="finput" autoComplete="email" /></div>
                <div><label className="flabel">Phone (optional)</label><input type="tel" ref={phoneRef} className="finput" autoComplete="tel" /></div>
              </div>

              {/* Shipping address */}
              <div className="section-box">
                <p className="section-title">Shipping Address</p>
                <div style={{ marginBottom: '0.8rem' }}><label className="flabel">Address Line 1 *</label><input type="text" ref={line1Ref} className="finput" autoComplete="address-line1" onBlur={handleAddressBlur} /></div>
                <div style={{ marginBottom: '0.8rem' }}><label className="flabel">Address Line 2</label><input type="text" ref={line2Ref} className="finput" autoComplete="address-line2" /></div>
                <div className="form-row" style={{ marginBottom: '0.8rem' }}>
                  <div><label className="flabel">City *</label><input type="text" ref={cityRef} className="finput" autoComplete="address-level2" onBlur={handleAddressBlur} /></div>
                  <div><label className="flabel">State *</label><input type="text" ref={stateRef} className="finput" maxLength={2} placeholder="WA" autoComplete="address-level1" style={{ textTransform: 'uppercase' }} onBlur={handleAddressBlur} /></div>
                </div>
                <div className="form-row">
                  <div><label className="flabel">ZIP Code *</label><input type="text" ref={zipRef} className="finput" autoComplete="postal-code" onBlur={handleAddressBlur} /></div>
                  <div><label className="flabel">Country</label><input type="text" ref={countryRef} className="finput" defaultValue="US" maxLength={2} style={{ textTransform: 'uppercase' }} /></div>
                </div>
              </div>

              {/* Payment */}
              <div className="section-box">
                <p className="section-title">Payment</p>
                <div id="payment-element"></div>
                <div id="card-errors">{cardError}</div>
                <button id="pay-btn" disabled={payDisabled} onClick={handlePay}>{payLabel}</button>
              </div>
            </div>

            {/* Right: order summary */}
            <div className="order-summary">
              <div className="section-box">
                <p className="section-title">Order Summary</p>
                <div id="order-items">
                  {cart.map((item, idx) => (
                    <div className="order-item" key={idx}>
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt={item.productName} />
                        : <div className="no-img-sm">📦</div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#6b5b47', fontSize: '0.88rem' }}>{item.productName}</div>
                        {item.variantLabel && <div style={{ color: '#aaa', fontSize: '0.78rem' }}>{item.variantLabel}</div>}
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>Qty: {item.qty}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#6b5b47', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>${(item.price * item.qty).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '0.8rem' }}>
                  <div className="total-row"><span>Subtotal</span><span id="sum-subtotal">${subtotal.toFixed(2)}</span></div>
                  <div className="total-row"><span>Shipping</span><span id="sum-shipping">{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span></div>
                  <div className="total-row"><span>Tax <span id="tax-status" style={{ fontSize: '0.75rem', color: '#aaa' }}>{taxStatus}</span></span><span id="sum-tax">{taxAmount > 0 ? `$${taxAmount.toFixed(2)}` : '$0.00'}</span></div>
                  <div className="total-row grand"><span>Total</span><span id="sum-total">${total.toFixed(2)}</span></div>
                </div>
              </div>
              <Link href="/store" style={{ display: 'block', textAlign: 'center', color: '#6b5b47', fontSize: '0.88rem', textDecoration: 'none' }}>← Edit cart</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
