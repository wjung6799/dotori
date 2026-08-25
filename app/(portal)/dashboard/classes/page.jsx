'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import PayPanel from '../../PayPanel';

// Categories are shown in the order families think about them, not the order
// Mongo returns them. Anything with an unknown category falls to "Other".
const CATEGORIES = [
  { key: 'reading', label: 'Reading & literacy (읽기)' },
  { key: 'writing', label: 'Writing (쓰기)' },
  { key: 'korean', label: 'Korean (한국어)' },
  { key: 'summer', label: 'Summer camp' },
  { key: '1on1', label: '1:1 lessons' },
];

function categoryLabel(key) {
  const found = CATEGORIES.find((c) => c.key === key);
  return found ? found.label : 'Other classes';
}

// 'fall-2025' → 'Fall 2025'. Anything that doesn't match is shown as stored.
function quarterLabel(q) {
  if (!q) return '';
  const [term, year] = String(q).split('-');
  if (!term || !year) return q;
  return `${term.charAt(0).toUpperCase()}${term.slice(1)} ${year}`;
}

function money(dollars) {
  return `$${Number(dollars || 0).toLocaleString('en-US')}`;
}

function priceLabel(cls) {
  if (!(cls.price > 0)) return 'Tuition on request';
  if (cls.priceMax && cls.priceMax > cls.price) return `${money(cls.price)}–${money(cls.priceMax)}`;
  return money(cls.price);
}

// A schedule like 'Tuesdays 4–5pm or Thursdays 4–5pm' means the family picks one.
function dayOptions(schedule) {
  if (!schedule || !schedule.includes(' or ')) return [];
  return schedule
    .split(' or ')
    .map((s) => s.trim())
    .filter(Boolean);
}

function sameName(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export default function ClassesPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [students, setStudents] = useState([]);

  const [justEnrolled, setJustEnrolled] = useState(false);

  // One class panel is open at a time — PayPanel mounts a single Stripe element.
  const [openId, setOpenId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [dayChoice, setDayChoice] = useState('');

  // Read straight from location: useSearchParams would force a Suspense
  // boundary around this whole page at build time.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('enrolled') === '1') setJustEnrolled(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [clsRes, enrRes, profRes] = await Promise.all([
          fetch('/api/classes'),
          fetch('/api/family/enrollments'),
          fetch('/api/family/profile'),
        ]);
        if (!clsRes.ok) throw new Error('Could not load the class list.');

        const clsData = await clsRes.json();
        const enrData = enrRes.ok ? await enrRes.json() : { enrollments: [] };
        const profData = profRes.ok ? await profRes.json() : { user: {} };

        if (cancelled) return;
        setClasses(Array.isArray(clsData.classes) ? clsData.classes : []);
        setEnrollments(Array.isArray(enrData.enrollments) ? enrData.enrollments : []);
        setStudents(((profData.user && profData.user.students) || []).filter((s) => s && s.name));
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Something went wrong loading this page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Students already holding a live (non-refunded) seat in a given class.
  function enrolledNames(classId) {
    return enrollments
      .filter((e) => e.paymentStatus !== 'refunded')
      .filter((e) => {
        const cid = e.classId && typeof e.classId === 'object' ? e.classId._id : e.classId;
        return String(cid || '') === String(classId);
      })
      .map((e) => e.studentName);
  }

  function openPanel(cls) {
    const id = String(cls._id);
    if (openId === id) {
      setOpenId('');
      return;
    }
    const taken = enrolledNames(id);
    const available = students.filter((s) => !taken.some((n) => sameName(n, s.name)));
    setOpenId(id);
    setStudentName(available.length ? available[0].name : '');
    setDayChoice('');
  }

  function createIntent(cls) {
    return async () => {
      const res = await fetch(`/api/classes/${cls._id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, dayChoice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start the enrollment.');
      return data;
    };
  }

  // Group once for render; /api/classes already sorts by the category order.
  const groups = [];
  for (const cls of classes) {
    const key = CATEGORIES.some((c) => c.key === cls.category) ? cls.category : 'other';
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: categoryLabel(key), items: [] };
      groups.push(group);
    }
    group.items.push(cls);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Group classes</h1>
          <p className="lede">
            Browse this term&rsquo;s classes and enroll your student. (그룹 수업 신청)
          </p>
        </div>
      </div>

      {justEnrolled ? (
        <p className="notice ok">
          Enrollment received — thank you! A receipt is on its way to your email, and the seat will
          show as <strong>Enrolled</strong> here once the payment settles.
        </p>
      ) : null}

      {loadError ? <p className="notice err">{loadError}</p> : null}

      {loading ? (
        <div className="card">
          <div className="empty">
            <span className="ico">📚</span>
            <p>Loading classes…</p>
          </div>
        </div>
      ) : null}

      {!loading && !loadError && classes.length === 0 ? (
        <div className="card">
          <div className="empty">
            <span className="ico">📚</span>
            <p>
              No classes are open for registration right now. New terms are posted a few weeks
              before they start — <Link href="/contact">ask us what&rsquo;s coming up</Link>.
            </p>
          </div>
        </div>
      ) : null}

      {!loading &&
        groups.map((group) => (
          <section key={group.key} style={{ marginBottom: '1.6rem' }}>
            <div className="card-head">
              <h2>{group.label}</h2>
              <span className="muted small nowrap">
                {group.items.length} class{group.items.length === 1 ? '' : 'es'}
              </span>
            </div>

            <div className="grid grid-2">
              {group.items.map((cls) => {
                const id = String(cls._id);
                const capacity = cls.capacity || 0;
                const taken = enrolledNames(id);
                const seatsLeft = Math.max(0, capacity - (cls.enrolledCount || 0));
                const isFull = capacity > 0 && seatsLeft === 0;
                const days = dayOptions(cls.schedule);
                const available = students.filter((s) => !taken.some((n) => sameName(n, s.name)));
                // Stripe rejects anything under 50 cents, so a mispriced class must never
                // get a pay button — the same floor the credits page uses.
                const payable = Math.round((cls.price || 0) * 100) >= 50;
                const open = openId === id;

                return (
                  <article key={id} className="card" style={{ margin: 0 }}>
                    <div className="card-head">
                      <h2>{cls.name}</h2>
                      {taken.length > 0 ? <span className="pill ok">Enrolled</span> : null}
                    </div>

                    <div className="stack" style={{ gap: '0.35rem' }}>
                      {cls.schedule ? <p className="mb0 mt0">{cls.schedule}</p> : null}
                      {cls.quarter ? (
                        <p className="mb0 mt0">
                          <span className="pill info">{quarterLabel(cls.quarter)}</span>
                        </p>
                      ) : null}
                      {cls.description ? (
                        <p className="muted small mb0 mt0">{cls.description}</p>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem 1rem',
                        marginTop: '0.9rem',
                      }}
                    >
                      <div>
                        <span className="strong">{priceLabel(cls)}</span>
                        {cls.earlyBirdPrice ? (
                          <span className="muted small"> · early bird {money(cls.earlyBirdPrice)}</span>
                        ) : null}
                      </div>
                      <span className={isFull ? 'pill err' : 'pill ok'}>
                        {isFull
                          ? `Full · ${cls.enrolledCount || 0}/${capacity}`
                          : `${cls.enrolledCount || 0} of ${capacity} seats taken`}
                      </span>
                    </div>

                    {isFull ? (
                      <p className="muted small mb0" style={{ marginTop: '0.75rem' }}>
                        This class is full. <Link href="/contact">Ask about the waitlist</Link>.
                      </p>
                    ) : (
                      <button
                        type="button"
                        className={open ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
                        style={{ marginTop: '0.9rem' }}
                        onClick={() => openPanel(cls)}
                      >
                        {open ? 'Close' : 'Enroll a student'}
                      </button>
                    )}

                    {open && !isFull ? (
                      <div
                        style={{
                          marginTop: '1rem',
                          paddingTop: '1rem',
                          borderTop: '1px solid var(--line-soft)',
                        }}
                      >
                        {students.length === 0 ? (
                          <div className="empty">
                            <span className="ico">🌱</span>
                            <p>
                              Add your student to your account first so we can link the class to
                              them.
                            </p>
                            <Link
                              href="/dashboard/students"
                              className="btn btn-primary btn-sm"
                              style={{ marginTop: '0.8rem' }}
                            >
                              Add a student
                            </Link>
                          </div>
                        ) : available.length === 0 ? (
                          <p className="notice info mb0">
                            Every student on your account is already enrolled in this class.
                          </p>
                        ) : (
                          <>
                            <div className="field">
                              <label htmlFor={`student-${id}`}>Student (학생)</label>
                              <select
                                id={`student-${id}`}
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                              >
                                {available.map((s) => (
                                  <option key={s.name} value={s.name}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {days.length > 0 ? (
                              <div className="field">
                                <label htmlFor={`day-${id}`}>Which day? (요일 선택)</label>
                                <select
                                  id={`day-${id}`}
                                  value={dayChoice}
                                  onChange={(e) => setDayChoice(e.target.value)}
                                >
                                  <option value="">Choose a day…</option>
                                  {days.map((d) => (
                                    <option key={d} value={d}>
                                      {d}
                                    </option>
                                  ))}
                                </select>
                                <p className="hint">
                                  This class meets on more than one day — pick the one you want.
                                </p>
                              </div>
                            ) : null}

                            {payable ? (
                              <PayPanel
                                key={id}
                                amountCents={Math.round(cls.price * 100)}
                                createIntent={createIntent(cls)}
                                returnUrl="/dashboard/classes?enrolled=1"
                                label={`Pay ${money(cls.price)}`}
                                disabled={!studentName || (days.length > 0 && !dayChoice)}
                              />
                            ) : (
                              // Tuition is 0 in the database for these classes, and Stripe
                              // rejects anything under 50¢ — so send the family to us instead
                              // of handing them a pay button that cannot work.
                              <>
                                <p className="notice info">
                                  Tuition for this class isn&rsquo;t set up for online payment yet.
                                  Get in touch and we&rsquo;ll register {studentName || 'your student'}{' '}
                                  and send an invoice.
                                </p>
                                <Link href="/contact" className="btn btn-primary btn-block">
                                  Enroll through the school
                                </Link>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
    </>
  );
}
