'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Admin viewer for the 1:1 waitlist (oldest first = queue order).

const BROWN = '#6b5b47';
const DARK = '#4a3c28';

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
    <main style={{ marginTop: 72 }}>
      <div className="container" style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '2rem 0 1.5rem' }}>
          <h1 style={{ color: DARK, fontSize: '1.6rem', margin: 0 }}>1:1 Waitlist</h1>
          <Link href="/admin" style={{ color: '#8b7355', fontWeight: 600 }}>← Admin home</Link>
        </div>

        {entries === null ? (
          <p style={{ color: BROWN }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p style={{ color: BROWN }}>The waitlist is empty.</p>
        ) : (
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 14px rgba(139,115,85,0.08)', marginBottom: '3rem' }}>
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  {['#', 'Signed up', 'Student', 'Grade', 'Parent', 'Phone', 'Email', 'Academic area', ''].map((h) => (
                    <th key={h} style={{ background: '#5d4a35', color: '#fff', textAlign: 'left', padding: '0.65rem 0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((en, i) => (
                  <tr key={en._id}>
                    <td style={td()}>{i + 1}</td>
                    <td style={{ ...td(), whiteSpace: 'nowrap' }}>{en.createdAt ? new Date(en.createdAt).toLocaleDateString() : ''}</td>
                    <td style={{ ...td(), fontWeight: 700, color: DARK }}>{en.studentName}</td>
                    <td style={td()}>{en.grade}</td>
                    <td style={td()}>{en.parentName}</td>
                    <td style={{ ...td(), whiteSpace: 'nowrap' }}>{en.phone}</td>
                    <td style={td()}>{en.email}</td>
                    <td style={{ ...td(), whiteSpace: 'pre-wrap' }}>{en.subject}</td>
                    <td style={td()}>
                      <button
                        type="button"
                        onClick={() => remove(en._id)}
                        style={{ background: 'none', border: '1px solid #d8cdbd', borderRadius: 6, color: '#a3261a', cursor: 'pointer', padding: '0.25rem 0.6rem', fontSize: '0.8rem', fontWeight: 700 }}
                      >
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
    </main>
  );
}

function td() {
  return { padding: '0.65rem 0.8rem', borderBottom: '1px solid #f0e9df', color: BROWN, verticalAlign: 'top' };
}
