'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Admin moderation for parent reviews: approve to publish on /reviews,
// unapprove to hide again, or delete entirely. Pending reviews come first.

const BROWN = '#6b5b47';
const DARK = '#4a3c28';

const PROGRAM_LABEL = {
  math: 'Math & Test Prep',
  literacy: 'English Literacy',
  korean: 'Korean',
  summer: 'Summer Camp',
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState(null);

  const load = () =>
    fetch('/api/admin/reviews')
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews || []))
      .catch(() => setReviews([]));

  useEffect(() => { load(); }, []);

  async function setApproved(id, approved) {
    await fetch(`/api/admin/reviews/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this review permanently?')) return;
    await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    load();
  }

  const pending = (reviews || []).filter((r) => !r.approved).length;

  return (
    <main style={{ marginTop: 72 }}>
      <div className="container" style={{ maxWidth: 860 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '2rem 0 1.5rem' }}>
          <h1 style={{ color: DARK, fontSize: '1.6rem', margin: 0 }}>
            Parent Reviews{pending ? ` · ${pending} pending` : ''}
          </h1>
          <Link href="/admin" style={{ color: '#8b7355', fontWeight: 600 }}>← Admin home</Link>
        </div>

        {reviews === null ? (
          <p style={{ color: BROWN }}>Loading…</p>
        ) : reviews.length === 0 ? (
          <p style={{ color: BROWN }}>No reviews submitted yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '3rem' }}>
            {reviews.map((r) => (
              <div
                key={r._id}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  borderLeft: `4px solid ${r.approved ? '#9cb356' : '#d9a83c'}`,
                  boxShadow: '0 4px 14px rgba(139,115,85,0.08)',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ color: DARK, fontWeight: 700, fontSize: '0.95rem' }}>
                    {r.parentName}
                    <span style={{ color: '#9b8b77', fontWeight: 500 }}> · {PROGRAM_LABEL[r.program] || r.program}</span>
                    <span style={{ color: '#d9a83c', marginLeft: 8 }}>{'★'.repeat(r.rating || 5)}</span>
                    <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 700, color: r.approved ? '#1e7a40' : '#b08a3a' }}>
                      {r.approved ? 'Published' : 'Pending'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {r.approved ? (
                      <button type="button" onClick={() => setApproved(r._id, false)} style={ghost()}>Hide</button>
                    ) : (
                      <button type="button" onClick={() => setApproved(r._id, true)} style={approve()}>Approve</button>
                    )}
                    <button type="button" onClick={() => remove(r._id)} style={danger()}>Delete</button>
                  </div>
                </div>
                <p style={{ color: BROWN, fontSize: '0.92rem', lineHeight: 1.6, margin: '0.5rem 0 0.2rem', whiteSpace: 'pre-wrap' }}>{r.text}</p>
                <div style={{ color: '#b8ab98', fontSize: '0.78rem' }}>
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const approve = () => ({ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#9cb356', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' });
const ghost = () => ({ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e6ddd2', background: '#fff', color: BROWN, cursor: 'pointer', fontSize: '0.85rem' });
const danger = () => ({ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e0b4a0', background: '#fff', color: '#b5654a', cursor: 'pointer', fontSize: '0.85rem' });
