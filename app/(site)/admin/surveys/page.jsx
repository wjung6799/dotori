'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Admin viewer for submitted New Student Enrollment Forms (one per student).

const BROWN = '#6b5b47';
const DARK = '#4a3c28';

const FIELDS = [
  ['studentFullName', 'Student Full Name'],
  ['preferredName', 'Preferred Name'],
  ['grade', 'Current Grade'],
  ['dateOfBirth', 'Date of Birth'],
  ['homeLanguage', 'Home Language'],
  ['homeLanguageOther', 'Home Language (Other)'],
  ['schoolType', 'School Type'],
  ['schoolTypeOther', 'School Type (Other)'],
  ['schoolDistrict', 'School District'],
  ['schoolDistrictOther', 'School District (Other)'],
  ['schoolName', 'School Name'],
  ['parentName', 'Parent/Guardian Name'],
  ['parentEmail', 'Email'],
  ['emergencyContact', 'Emergency Contact'],
  ['learningStyle', 'Learning style / personality'],
  ['academicAreas', 'Areas they enjoy / find challenging'],
  ['healthNotes', 'Health, allergies, special needs'],
  ['hobbies', 'Sports, instruments, hobbies'],
  ['otherNotes', 'Anything else for the teacher'],
  ['mediaRelease', 'Media Release'],
  ['referral', 'How did you hear about us'],
  ['referralOther', 'Referral (Other)'],
];

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
                {openId === s._id ? (
                  <div style={{ borderTop: '1px solid #f0e9df', padding: '1rem 1.2rem', display: 'grid', gap: '0.5rem' }}>
                    {FIELDS.map(([key, label]) => {
                      const raw = s[key];
                      const value = Array.isArray(raw) ? raw.join(', ') : raw;
                      if (!value) return null;
                      return (
                        <div key={key} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
                          <span style={{ color: '#9b8b77', fontWeight: 600 }}>{label}</span>
                          <span style={{ color: BROWN, whiteSpace: 'pre-wrap' }}>{value}</span>
                        </div>
                      );
                    })}
                    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
                      <span style={{ color: '#9b8b77', fontWeight: 600 }}>Consents</span>
                      <span style={{ color: BROWN }}>
                        Personal info ✓ · Liability waiver ✓ · Handbook ✓ · Media release: {s.mediaRelease === 'agree' ? 'agreed' : 'declined'}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
