'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Group classes are placed by the school, not self-served: a student is put in a
// level after their assessment, and the office records the enrollment. So this
// page is read-only — what your students are in, and what is running this term.
// Booking a 1:1 session is the one thing families do for themselves; that lives
// at /dashboard/booking.


const CATEGORY_ORDER = ['reading', 'writing', 'korean', 'summer', '1on1'];
const CATEGORY_LABEL = {
  reading: 'Reading',
  writing: 'Writing',
  korean: 'Korean',
  summer: 'Summer Camp',
  '1on1': 'Private & semi-private',
};

// Derived, not hand-listed: a term the school adds later would otherwise show a
// parent the raw slug like "fall-2026".
const quarterLabel = (q) => {
  if (!q) return '';
  const [season, year] = String(q).split('-');
  if (!year) return q;
  return season.charAt(0).toUpperCase() + season.slice(1) + ' ' + year;
};

export default function ClassesPage() {
  const [classes, setClasses] = useState(null); // null = loading
  const [enrollments, setEnrollments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [clsRes, enrRes] = await Promise.all([
          fetch('/api/classes'),
          fetch('/api/family/enrollments'),
        ]);
        if (cancelled) return;
        const clsData = clsRes.ok ? await clsRes.json() : { classes: [] };
        const enrData = enrRes.ok ? await enrRes.json() : { enrollments: [] };
        if (cancelled) return;
        setClasses(clsData.classes || []);
        setEnrollments((enrData.enrollments || []).filter((e) => e.paymentStatus !== 'refunded'));
      } catch {
        if (!cancelled) {
          setClasses([]);
          setError('We could not load the class list. Please refresh, or contact the school.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // An enrollment's classId arrives populated, but fall back to a bare id so a
  // lean query shape never blanks the row.
  const classIdOf = (en) =>
    typeof en.classId === 'object' && en.classId ? String(en.classId._id ?? '') : String(en.classId ?? '');

  const enrolledIds = new Set(enrollments.map(classIdOf).filter(Boolean));

  // Group the catalog by category, keeping the school's own ordering.
  const groups = [];
  for (const key of CATEGORY_ORDER) {
    const inGroup = (classes || []).filter((c) => c.category === key);
    if (inGroup.length) groups.push({ key, label: CATEGORY_LABEL[key], classes: inGroup });
  }
  const other = (classes || []).filter((c) => !CATEGORY_ORDER.includes(c.category));
  if (other.length) groups.push({ key: 'other', label: 'Other classes', classes: other });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Group classes</h1>
          <p className="lede">
            Your students&rsquo; classes, and what&rsquo;s running this term.
          </p>
        </div>
        <Link href="/contact" className="btn btn-ghost">
          Ask about a class
        </Link>
      </div>

      {error ? <div className="notice err">{error}</div> : null}

      {/* ── What my students are in ─────────────────────────────── */}
      <section className="card">
        <div className="card-head">
          <h2>Your students&rsquo; classes</h2>
          <Link href="/dashboard/students" className="link">My students →</Link>
        </div>

        {classes === null ? (
          <div className="empty">
            <p>Loading…</p>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">📚</span>
            <p>
              No group classes yet. Placement happens after your child&rsquo;s assessment — talk to
              us and we&rsquo;ll find the right level.
            </p>
          </div>
        ) : (
          <div className="stack">
            {enrollments.map((en) => (
              <div className="row" key={String(en._id)}>
                <span className="main">
                  <span className="strong">{en.studentName}</span>
                  <span className="meta">
                    {' · '}
                    {en.classId?.name || 'Class'}
                    {en.classId?.schedule ? ` · ${en.classId.schedule}` : ''}
                    {en.dayChoice ? ` · ${en.dayChoice}` : ''}
                  </span>
                  {en.quarter ? <div className="meta small">{quarterLabel(en.quarter)}</div> : null}
                </span>
                <span className={`pill ${en.paymentStatus === 'paid' ? 'ok' : 'warn'}`}>
                  {en.paymentStatus === 'paid' ? 'Enrolled' : 'Payment pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── The term's catalog, for reference ───────────────────── */}
      <section className="card">
        <div className="card-head">
          <h2>This term at Dotori</h2>
        </div>

        <p className="muted small" style={{ marginTop: 0 }}>
          Students are placed into a level after their assessment, so classes aren&rsquo;t signed up
          for online. If one looks right for your child, mention it at your next session or{' '}
          <Link href="/contact">contact the school</Link> and we&rsquo;ll sort out the placement and
          the tuition together.
        </p>

        {classes === null ? (
          <div className="empty">
            <p>Loading the class list…</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">🗓</span>
            <p>No classes are published for this term yet.</p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.key} style={{ marginBottom: '1.4rem' }}>
              <h3
                style={{
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ink-3)',
                  marginBottom: '0.6rem',
                }}
              >
                {g.label}
              </h3>
              <div className="grid-2">
                {g.classes.map((c) => {
                  const taken = c.manualEnrolled ?? c.enrolledCount ?? 0;
                  const full = taken >= (c.capacity ?? 0);
                  const mine = enrolledIds.has(String(c._id));
                  return (
                    <div
                      key={String(c._id)}
                      style={{
                        background: 'var(--surface-2)',
                        border: `1px solid ${mine ? 'var(--accent)' : 'var(--line-soft)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.9rem 1.05rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '0.6rem',
                        }}
                      >
                        <span className="strong">{c.name}</span>
                        {mine ? <span className="pill ok nowrap">Enrolled</span> : null}
                      </div>

                      <div className="muted small">
                        {c.schedule || 'Schedule to be confirmed'}
                        {c.quarter ? ` · ${quarterLabel(c.quarter)}` : ''}
                      </div>

                      {c.description ? (
                        <p className="small" style={{ color: 'var(--ink-2)', margin: '0.5rem 0 0.6rem' }}>
                          {c.description}
                        </p>
                      ) : (
                        <div style={{ height: '0.5rem' }} />
                      )}

                      <span className={`pill ${full ? 'err' : 'ok'}`}>
                        {full ? 'Full' : `${Math.max(0, (c.capacity ?? 0) - taken)} of ${c.capacity} seats open`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
