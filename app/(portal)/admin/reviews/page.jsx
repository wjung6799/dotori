'use client';

import { useEffect, useState } from 'react';

// Admin moderation for parent reviews: approve to publish on /reviews,
// unapprove to hide again, or delete entirely. Pending reviews come first.

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
    <>
      <div className="page-head">
        <div>
          <h1>Parent reviews</h1>
          <p className="lede">
            Approve a review to publish it on the site, hide it again, or delete it for good.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Submitted reviews</h2>
          {pending ? <span className="pill warn">{pending} pending</span> : null}
        </div>

        {reviews === null ? (
          <p className="muted small mb0">Loading…</p>
        ) : reviews.length === 0 ? (
          <div className="empty">
            <span className="ico">⭐</span>
            <p>No reviews submitted yet.</p>
          </div>
        ) : (
          <div className="stack">
            {reviews.map((r) => (
              <div className="row" key={r._id}>
                <div className="main">
                  <div>
                    <span className="strong">{r.parentName}</span>
                    <span className="muted small"> · {PROGRAM_LABEL[r.program] || r.program}</span>
                    <span style={{ color: '#d9a83c', marginLeft: 8 }}>{'★'.repeat(r.rating || 5)}</span>{' '}
                    <span className={r.approved ? 'pill ok' : 'pill warn'}>
                      {r.approved ? 'Published' : 'Pending'}
                    </span>
                  </div>
                  <p className="small" style={{ whiteSpace: 'pre-wrap', margin: '0.4rem 0 0.25rem' }}>
                    {r.text}
                  </p>
                  <div className="muted small">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                  </div>
                </div>
                <div className="meta" style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  {r.approved ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setApproved(r._id, false)}>
                      Hide
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setApproved(r._id, true)}>
                      Approve
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(r._id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
