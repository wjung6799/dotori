'use client';

import { useEffect, useState } from 'react';

// Admin viewer for the 1:1 waitlist (oldest first = queue order).

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState(null);

  const load = () =>
    fetch('/api/admin/waitlist')
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => setEntries([]));

  useEffect(() => { load(); }, []);

  async function remove(id) {
    if (!confirm('Remove this waitlist entry? (Do this after contacting the family.)')) return;
    await fetch(`/api/admin/waitlist/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Waitlist</h1>
          <p className="lede">Families waiting for a 1:1 seat — oldest first, which is queue order.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>1:1 queue</h2>
        </div>

        {entries === null ? (
          <p className="muted small">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="empty">
            <span className="ico">🌰</span>
            <p>The waitlist is empty.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Signed up</th>
                  <th>Student</th>
                  <th>Grade</th>
                  <th>Parent</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Academic area</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((en, i) => (
                  <tr key={en._id}>
                    <td className="num">{i + 1}</td>
                    <td className="nowrap">{en.createdAt ? new Date(en.createdAt).toLocaleDateString() : ''}</td>
                    <td className="strong">{en.studentName}</td>
                    <td>{en.grade}</td>
                    <td>{en.parentName}</td>
                    <td className="nowrap">{en.phone}</td>
                    <td>{en.email}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{en.subject}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(en._id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
