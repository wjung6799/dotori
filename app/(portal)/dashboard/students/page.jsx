'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LocalTime from '../../LocalTime';

const QUARTER_LABEL = {
  'fall-2025': 'Fall 2025',
  'winter-2026': 'Winter 2026',
  'spring-2026': 'Spring 2026',
  'summer-2026': 'Summer 2026',
};

const GRADE_OPTIONS = ['Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function gradeLabel(g) {
  if (!g) return '';
  if (g === 'Pre-K') return 'Preschool';
  if (g === 'K') return 'Kindergarten';
  return 'Grade ' + g;
}

function surveyHref(name) {
  return `/profile/enrollment-survey?student=${encodeURIComponent(name)}`;
}

export default function StudentsPage() {
  // profile === null means "not loaded yet"; loadError means the PUT must stay
  // disabled, because saving without the loaded name/phone would wipe them.
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [surveys, setSurveys] = useState([]);
  const [enrollments, setEnrollments] = useState([]);

  // Editable copy of the students list. Each row keeps `orig`, the name it was
  // loaded under, so we can warn when a rename would orphan that student's
  // survey and bookings (both are matched by name, not by id).
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/family/profile');
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        const user = data.user || {};
        setProfile(user);
        setRows(
          (user.students || []).map((s) => ({
            name: s.name || '',
            grade: s.grade || '',
            orig: s.name || '',
          })),
        );
      } catch {
        if (!cancelled) setLoadError('We could not load your family profile. Please refresh and try again.');
      }

      // The two side lists are decorations on the student cards: if either call
      // fails the page still works, the badges just read "not submitted".
      try {
        const res = await fetch('/api/family/survey');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSurveys(data.surveys || []);
        }
      } catch {
        /* badges fall back to "Not submitted" */
      }

      try {
        const res = await fetch('/api/family/enrollments');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setEnrollments(data.enrollments || []);
        }
      } catch {
        /* class list falls back to its empty state */
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateRow(i, field, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { name: '', grade: '', orig: '' }]);
  }

  function removeRow(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!profile || saving) return;

    const students = rows
      .map((r) => ({ name: (r.name || '').trim(), grade: r.grade }))
      .filter((s) => s.name);

    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/family/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // firstName/lastName/phone are echoed back untouched — the route replaces
        // the whole document, so omitting them would blank the account.
        body: JSON.stringify({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          phone: profile.phone || '',
          students,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const user = data.user || {};
      setProfile(user);
      setRows(
        (user.students || []).map((s) => ({
          name: s.name || '',
          grade: s.grade || '',
          orig: s.name || '',
        })),
      );
      setMsg({ type: 'ok', text: 'Saved. Your students are up to date.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'We could not save your changes. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  const savedStudents = (profile?.students || []).filter((s) => s.name);
  const activeEnrollments = enrollments.filter((en) => en.paymentStatus !== 'refunded');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Students</h1>
          <p className="lede">
            Your children, their enrolment forms and the classes they are signed up for.
          </p>
        </div>
      </div>

      {loadError ? <div className="notice err">{loadError}</div> : null}

      {/* Skeleton, not null: the editor card below shifts if this area collapses. */}
      {profile === null && !loadError ? (
        <div className="card">
          <div className="empty">
            <span className="ico">🌱</span>
            <p>Loading your students…</p>
          </div>
        </div>
      ) : null}

      {profile && savedStudents.length === 0 ? (
        <div className="card">
          <div className="empty">
            <span className="ico">🌱</span>
            <p>No students saved yet. Add your first one below so we can match their forms and classes.</p>
          </div>
        </div>
      ) : null}

      {savedStudents.map((s, i) => {
        const submitted = surveys.some((sv) => sv.studentName === s.name);
        const classes = activeEnrollments.filter((en) => en.studentName === s.name);
        return (
          <section className="card" key={`${s.name}-${i}`}>
            <div className="card-head">
              <h2>
                {s.name}
                {s.grade ? <span className="muted small nowrap">{'  ·  ' + gradeLabel(s.grade)}</span> : null}
              </h2>
              <a className="link" href={surveyHref(s.name)}>
                {submitted ? 'Edit form (수정) →' : 'Fill out form (작성하기) →'}
              </a>
            </div>

            <div className="row">
              <div className="main">
                <div className="strong">Enrolment form (신규 학생 등록 신청서)</div>
                <div className="meta">One form per student — it tells us how {s.name} learns best.</div>
              </div>
              <span className={submitted ? 'pill ok' : 'pill warn'}>
                {submitted ? 'Submitted' : 'Not submitted'}
              </span>
            </div>

            <div style={{ marginTop: '1.1rem' }}>
              <div className="flabel">Enrolled classes (수강 중인 수업)</div>
              {classes.length === 0 ? (
                <div className="empty">
                  <span className="ico">📚</span>
                  <p>Not enrolled in a group class yet.</p>
                </div>
              ) : (
                <div className="stack">
                  {classes.map((en) => {
                    const meta = [
                      en.classId?.schedule,
                      en.dayChoice,
                      QUARTER_LABEL[en.quarter] || en.quarter,
                    ].filter(Boolean);
                    return (
                      <div className="row" key={en._id}>
                        <div className="main">
                          <div className="strong">{en.classId?.name || 'Class'}</div>
                          <div className="meta">
                            {meta.join(' · ')}
                            {en.enrolledAt ? (
                              <>
                                {meta.length ? ' · ' : ''}
                                signed up <LocalTime iso={en.enrolledAt} format="date" />
                              </>
                            ) : null}
                          </div>
                        </div>
                        <span className={en.paymentStatus === 'paid' ? 'pill ok' : 'pill warn'}>
                          {en.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        );
      })}

      <section className="card">
        <div className="card-head">
          <h2>Add or edit students</h2>
          <Link className="link" href="/dashboard/account">
            Parent details →
          </Link>
        </div>

        {msg ? <div className={msg.type === 'ok' ? 'notice ok' : 'notice err'}>{msg.text}</div> : null}

        {loadError ? (
          <p className="muted small mb0">
            Editing is unavailable until your profile loads — saving now would clear your contact details.
          </p>
        ) : (
          <form onSubmit={handleSave}>
            {rows.length === 0 ? (
              <div className="empty">
                <span className="ico">✏️</span>
                <p>No students in the list. Add one below.</p>
              </div>
            ) : (
              <div className="stack">
                {rows.map((r, i) => {
                  const renamed = r.orig && r.name.trim() !== r.orig;
                  return (
                    <div className="row" key={i} style={{ alignItems: 'flex-end' }}>
                      <div className="main" style={{ flex: '1 1 220px' }}>
                        <div className="field mb0">
                          <label htmlFor={`student-name-${i}`}>Student name (학생 이름)</label>
                          <input
                            id={`student-name-${i}`}
                            type="text"
                            placeholder="First and last name"
                            value={r.name}
                            onChange={(e) => updateRow(i, 'name', e.target.value)}
                          />
                          {r.orig ? (
                            <p className="hint">
                              {renamed
                                ? `Heads up: this student's enrolment form and bookings are filed under “${r.orig}”. Saving a new name unlinks them.`
                                : 'Enrolment forms and bookings are matched by name, so renaming unlinks them.'}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ flex: '0 1 170px' }}>
                        <div className="field mb0">
                          <label htmlFor={`student-grade-${i}`}>Grade (학년)</label>
                          <select
                            id={`student-grade-${i}`}
                            value={r.grade}
                            onChange={(e) => updateRow(i, 'grade', e.target.value)}
                          >
                            <option value="">Select grade</option>
                            {GRADE_OPTIONS.map((g) => (
                              <option key={g} value={g}>
                                {gradeLabel(g)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeRow(i)}
                        aria-label={r.name ? `Remove ${r.name}` : 'Remove this student'}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.6rem',
                marginTop: '1.1rem',
                alignItems: 'center',
              }}
            >
              <button type="button" className="btn btn-ghost" onClick={addRow}>
                + Add student
              </button>
              <button type="submit" className="btn btn-primary" disabled={!profile || saving}>
                {saving ? 'Saving…' : 'Save students'}
              </button>
            </div>

            <p className="muted small mb0" style={{ marginTop: '0.7rem' }}>
              Rows without a name are dropped when you save. Removing a student here does not cancel any
              class they are enrolled in — contact the school for that.
            </p>
          </form>
        )}
      </section>
    </>
  );
}
