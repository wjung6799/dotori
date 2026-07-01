'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const statusConfig = {
  pending:     { icon: '⏳', label: 'Payment Pending',  sub: 'Waiting for payment confirmation.' },
  paid:        { icon: '✅', label: 'Order Confirmed',   sub: 'Your order is being prepared for shipment.' },
  partial:     { icon: '⚙️', label: 'In Production',     sub: 'Your order is being printed and prepared.' },
  unfulfilled: { icon: '📋', label: 'Processing',        sub: 'Your order is queued for fulfillment.' },
  fulfilled:   { icon: '📦', label: 'Shipped',           sub: 'Your order is on its way!' },
  error:       { icon: '⚠️', label: 'Fulfillment Issue', sub: "We're looking into this. Please contact us." },
  refunded:    { icon: '💳', label: 'Refunded',          sub: 'Your payment has been refunded.' },
};

function OrderStatusInner() {
  const searchParams = useSearchParams();
  const [view, setView] = useState('loading'); // 'loading' | 'order' | 'error'
  const [order, setOrder] = useState(null);
  const [token, setToken] = useState(null);
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    const tok = searchParams.get('token');
    setToken(tok);

    async function loadOrder() {
      if (!tok) {
        setView('error');
        return;
      }

      try {
        const res = await fetch(`/api/shop/order-status/${tok}`);
        const data = await res.json();
        if (!res.ok || !data.order) throw new Error('Not found');

        const o = data.order;
        setOrder(o);
        setView('order');

        // Auto-refresh if not yet shipped
        if (o.fulfillmentStatus !== 'fulfilled' && o.paymentStatus !== 'refunded') {
          if (!refreshIntervalRef.current) {
            refreshIntervalRef.current = setInterval(loadOrder, 60000);
          }
        } else {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      } catch (err) {
        setView('error');
      }
    }

    loadOrder();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [searchParams]);

  // Derive display values when an order is present
  let st, config, a;
  if (order) {
    st = order.fulfillmentStatus === 'fulfilled' ? 'fulfilled'
      : order.paymentStatus === 'refunded' ? 'refunded'
      : order.fulfillmentStatus === 'error' ? 'error'
      : order.paymentStatus === 'paid' ? (order.fulfillmentStatus === 'unfulfilled' ? 'paid' : 'partial')
      : 'pending';
    config = statusConfig[st] || statusConfig.pending;
    a = order.address;
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem 5rem', maxWidth: 640, margin: '0 auto' }}>

      {view === 'loading' && (
        <div style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading order status…</div>
      )}

      {view === 'order' && order && (
        <div>
          <h1 style={{ color: '#6b5b47', fontSize: '1.5rem', marginBottom: '0.3rem' }}>Order Status</h1>
          <p id="order-id-line" style={{ color: '#aaa', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            Order #{token.slice(0, 8).toUpperCase()} · Placed {new Date(order.createdAt).toLocaleDateString()}
          </p>

          {/* Status badge */}
          <div id="status-bar" style={{ background: '#fff', border: '1px solid #e8e0d8', borderRadius: 14, padding: '1.2rem 1.5rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div id="status-icon" style={{ fontSize: '2rem' }}>{config.icon}</div>
            <div>
              <div id="status-label" style={{ fontWeight: 700, color: '#6b5b47', fontSize: '1.05rem' }}>{config.label}</div>
              <div id="status-sub" style={{ color: '#aaa', fontSize: '0.85rem' }}>{config.sub}</div>
            </div>
          </div>

          {/* Tracking */}
          {order.trackingNumber && (
            <div id="tracking-box" style={{ background: '#f0f7ef', border: '1px solid #c8e0c4', borderRadius: 14, padding: '1.2rem 1.5rem', marginBottom: '1.2rem' }}>
              <div style={{ fontWeight: 700, color: '#2d6a2d', marginBottom: '0.4rem' }}>📦 Shipment Tracking</div>
              <div id="tracking-info" style={{ color: '#444', fontSize: '0.9rem', lineHeight: 1.7 }}>
                <strong>Carrier:</strong> {order.carrier || 'Carrier'}<br />
                <strong>Tracking #:</strong> {order.trackingNumber}<br />
                {order.trackingUrl && (
                  <a href={order.trackingUrl} target="_blank" rel="noopener" style={{ color: '#2d6a2d', fontWeight: 600 }}>Track Package →</a>
                )}
                {order.shippedAt && (
                  <><br /><strong>Shipped:</strong> {new Date(order.shippedAt).toLocaleDateString()}</>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div style={{ background: '#fff', border: '1px solid #e8e0d8', borderRadius: 14, padding: '1.2rem 1.5rem', marginBottom: '1.2rem' }}>
            <div style={{ fontWeight: 700, color: '#6b5b47', marginBottom: '0.8rem' }}>Items Ordered</div>
            <div id="order-items">
              {order.items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f5f0eb', fontSize: '0.9rem' }}>
                  <span style={{ color: '#444' }}>{i.productName}{i.variantLabel ? ' – ' + i.variantLabel : ''} × {i.quantity}</span>
                  <span style={{ fontWeight: 600, color: '#6b5b47' }}>${(i.unitPrice * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #eee', marginTop: '0.6rem', paddingTop: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.88rem', marginBottom: '0.3rem' }}><span>Subtotal</span><span id="os-subtotal">${order.subtotal.toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.88rem', marginBottom: '0.3rem' }}><span>Shipping</span><span id="os-shipping">{order.shippingCost === 0 ? 'Free' : `$${order.shippingCost.toFixed(2)}`}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.88rem', marginBottom: '0.4rem' }}><span>Tax</span><span id="os-tax">${(order.taxAmount || 0).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#6b5b47', fontSize: '1rem' }}><span>Total</span><span id="os-total">${order.total.toFixed(2)}</span></div>
            </div>
          </div>

          {/* Shipping address */}
          <div style={{ background: '#fff', border: '1px solid #e8e0d8', borderRadius: 14, padding: '1.2rem 1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, color: '#6b5b47', marginBottom: '0.5rem' }}>Shipping Address</div>
            <div id="os-address" style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {order.firstName} {order.lastName}<br />
              {a.line1}{a.line2 ? ', ' + a.line2 : ''}<br />
              {a.city}, {a.state} {a.zip}
            </div>
          </div>

          <Link href="/store" style={{ display: 'inline-block', color: '#6b5b47', fontSize: '0.9rem', textDecoration: 'none' }}>← Continue Shopping</Link>
        </div>
      )}

      {view === 'error' && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          <p>Order not found. Please check your confirmation email for the correct link.</p>
          <Link href="/store" style={{ color: '#6b5b47' }}>← Back to Shop</Link>
        </div>
      )}

    </div>
  );
}

export default function OrderStatusPage() {
  return (
    <Suspense>
      <OrderStatusInner />
    </Suspense>
  );
}
