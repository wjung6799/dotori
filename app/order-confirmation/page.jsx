'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function OrderConfirmationInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading' | 'confirmed' | 'error'
  const [order, setOrder] = useState(null);

  useEffect(() => {
    async function init() {
      // Clear the cart
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('dotori_cart');
      }

      // Get payment_intent from Stripe redirect
      const piId = searchParams.get('payment_intent');

      if (!piId) {
        setStatus('error');
        return;
      }

      try {
        const res = await fetch(`/api/shop/order-by-pi/${piId}`);
        const data = await res.json();
        if (!res.ok || !data.order) throw new Error('Order not found');
        setOrder(data.order);
        setStatus('confirmed');
      } catch (err) {
        setStatus('error');
      }
    }
    init();
  }, [searchParams]);

  return (
    <div className="container" style={{ padding: '3rem 1rem 5rem', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>

      {status === 'loading' && (
        <div style={{ color: '#aaa', padding: '3rem' }}>Loading your order…</div>
      )}

      {status === 'confirmed' && order && (
        <div>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h1 style={{ color: '#5b8a4a', fontSize: '1.8rem', marginBottom: '0.5rem' }}>Order Confirmed!</h1>
          <p style={{ color: '#666', marginBottom: '2rem' }}>Thank you for your purchase. A confirmation email has been sent to <strong id="conf-email">{order.email}</strong>.</p>

          <div style={{ background: '#fff', border: '1px solid #e8e0d8', borderRadius: 14, padding: '1.5rem', textAlign: 'left', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, color: '#6b5b47', marginBottom: '1rem' }}>Order Summary</div>
            <div id="conf-items">
              {order.items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f5f0eb', fontSize: '0.9rem' }}>
                  <span style={{ color: '#444' }}>{i.productName}{i.variantLabel ? ' – ' + i.variantLabel : ''} × {i.quantity}</span>
                  <span style={{ fontWeight: 600, color: '#6b5b47' }}>${(i.unitPrice * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.8rem', borderTop: '1px solid #eee', paddingTop: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                <span>Subtotal</span><span id="conf-subtotal">${order.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                <span>Shipping</span><span id="conf-shipping">{order.shippingCost === 0 ? 'Free' : `$${order.shippingCost.toFixed(2)}`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <span>Tax</span><span id="conf-tax">${(order.taxAmount || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#6b5b47', fontSize: '1rem' }}>
                <span>Total</span><span id="conf-total">${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8e0d8', borderRadius: 14, padding: '1.2rem 1.5rem', textAlign: 'left', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, color: '#6b5b47', marginBottom: '0.5rem' }}>Shipping To</div>
            <div id="conf-address" style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {order.firstName} {order.lastName}<br />
              {order.address.line1}{order.address.line2 ? ', ' + order.address.line2 : ''}<br />
              {order.address.city}, {order.address.state} {order.address.zip}
            </div>
          </div>

          <Link id="track-btn" href={`/order-status?token=${order.lookupToken}`} style={{ display: 'block', background: '#6b5b47', color: '#fff', padding: '0.85rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Track Your Order →
          </Link>
          <Link href="/store" style={{ display: 'block', color: '#6b5b47', fontSize: '0.9rem', textDecoration: 'none' }}>
            ← Continue Shopping
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div style={{ color: '#e00', padding: '2rem' }}>
          <p>Could not load your order. Please check your email for the confirmation.</p>
          <Link href="/store" style={{ color: '#6b5b47' }}>← Back to Shop</Link>
        </div>
      )}

    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense>
      <OrderConfirmationInner />
    </Suspense>
  );
}
