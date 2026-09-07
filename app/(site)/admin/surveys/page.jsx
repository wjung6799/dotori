'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SurveyDetails from '../SurveyDetails';

// Admin viewer for submitted New Student Enrollment Forms (one per student).

const BROWN = '#6b5b47';
const DARK = '#4a3c28';


function famName(u) {
  if (!u) return 'Family';
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email;
}

export default function AdminSurveysPage() {
  const [surveys, setSurveys] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    fetch('/api/admin/surveys')
      .then((r) => r.json())
      .then((d) => setSurveys(d.surveys || []))
      .catch(() => setSurveys([]));
  }, []);

  return (
    <main style={{ marginTop: 72 }}>
      <div className="container" style={{ maxWidth: 860 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '2rem 0 1.5rem' }}>
          <h1 style={{ color: DARK, fontSize: '1.6rem', margin: 0 }}>Enrollment Surveys</h1>
          <Link href="/admin" style={{ color: '#8b7355', fontWeight: 600 }}>← Admin home</Link>
        </div>

        {surveys === null ? (
          <p style={{ color: BROWN }}>Loading…</p>
        ) : surveys.length === 0 ? (
          <p style={{ color: BROWN }}>No surveys submitted yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '3rem' }}>
            {surveys.map((s) => (
              <div key={s._id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 14px rgba(139,115,85,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === s._id ? null : s._id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.9rem 1.2rem',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: DARK, fontWeight: 700, fontSize: '0.98rem' }}>
                    {s.studentName}
                    <span style={{ color: '#9b8b77', fontWeight: 500 }}> · {famName(s.userId)}{s.userId?.email ? ` (${s.userId.email})` : ''}</span>
                  </span>
                  <span style={{ color: '#9b8b77', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''} {openId === s._id ? '▴' : '▾'}
                  </span>
                </button>
                {openId === s._id ? <SurveyDetails survey={s} /> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
