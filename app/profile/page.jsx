'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const QUARTER_LABEL = {
  'fall-2025': 'Fall 2025',
  'winter-2026': 'Winter 2026',
  'spring-2026': 'Spring 2026',
  'summer-2026': 'Summer 2026',
};

const GRADE_OPTIONS = ['Pre-K', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function gradeLabel(g) {
  if (g === 'Pre-K') return 'Preschool';
  if (g === 'K') return 'Kindergarten';
  return 'Grade ' + g;
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('account');

  const [reports, setReports] = useState(null);

  // Account form state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStudents, setEditStudents] = useState([]);
  const [accountMsg, setAccountMsg] = useState(null); // { type: 'success'|'error', text }

  // ---- Init: load user ----
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Auth is handled by Auth.js (next-auth). Identity comes from the session;
      // middleware already gates this route, but redirect defensively too.
      if (status === 'loading') return;
      if (status !== 'authenticated' || !session?.user) {
        router.push('/login');
        return;
      }
      if (cancelled) return;
      // Richer family data (firstName/lastName/phone/students) lives in the
      // Express backend; we reach it through the authenticated /api proxy
      // (app/api/[...path]/route.js attaches the session identity). Fall back to
      // the session for name/email if the backend is unreachable.
      let profile = null;
      try {
        const res = await fetch('/api/family/profile');
        if (res.ok) {
          const data = await res.json();
          profile = data.user;
        }
      } catch {
        /* backend unavailable — fall back to session below */
      }
      if (cancelled) return;
      setCurrentUser({
        name: profile?.name ?? session.user.name ?? '',
        email: profile?.email ?? session.user.email ?? '',
        firstName: profile?.firstName ?? '',
        lastName: profile?.lastName ?? '',
        phone: profile?.phone ?? '',
        students: profile?.students ?? [],
        role: profile?.role ?? session.user.role ?? 'user',
      });
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router, status, session]);

  // Populate account form when user loads
  useEffect(() => {
    if (!currentUser) return;
    setEditFirstName(currentUser.firstName || '');
    setEditLastName(currentUser.lastName || '');
    setEditPhone(currentUser.phone || '');
    setEditStudents((currentUser.students || []).map((s) => ({ name: s.name || '', grade: s.grade || '' })));
  }, [currentUser]);

  // ---- Tab data loading ----
  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'reports') loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser]);

  async function loadReports() {
    const res = await fetch('/api/family/reports');
    const data = await res.json();
    setReports(data.reports || []);
  }

  // ---- Account form ----
  function addEditStudentRow(name = '', grade = '') {
    setEditStudents((prev) => [...prev, { name, grade }]);
  }
  function updateStudent(index, field, value) {
    setEditStudents((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }
  function removeStudent(index) {
    setEditStudents((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAccountSubmit(e) {
    e.preventDefault();
    const students = editStudents
      .map((s) => ({ name: (s.name || '').trim(), grade: s.grade }))
      .filter((s) => s.name);
    try {
      const res = await fetch('/api/family/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          phone: editPhone,
          students,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentUser(data.user);
      setAccountMsg({ type: 'success', text: 'Changes saved!' });
      setTimeout(() => setAccountMsg(null), 3000);
    } catch (err) {
      setAccountMsg({ type: 'error', text: err.message || 'Failed to save changes.' });
    }
  }

  async function logout() {
    await signOut({ callbackUrl: '/' });
  }

  // ---- Render helpers ----
  function renderReports() {
    if (reports === null) return <p style={{ color: '#aaa' }}>Loading…</p>;
    if (reports.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#aaa' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📄</div>
          <p>No report cards yet. Reports will appear here when your teacher uploads them.</p>
        </div>
      );
    }
    return reports.map((r, i) => (
      <div
        key={i}
        style={{
          border: '1px solid #eee',
          borderRadius: 12,
          padding: '1.2rem 1.5rem',
          marginBottom: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: '#6b5b47' }}>{r.title}</div>
          <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            {r.studentName} · {QUARTER_LABEL[r.quarter] || r.quarter} {r.classId ? '· ' + r.classId.name : ''}
          </div>
          <div style={{ color: '#aaa', fontSize: '0.78rem', marginTop: '0.2rem' }}>
            {new Date(r.uploadedAt).toLocaleDateString()}
          </div>
        </div>
        <a
          href={`/${r.pdfPath}`}
          target="_blank"
          rel="noreferrer"
          style={{
            background: '#f5f0eb',
            color: '#6b5b47',
            fontWeight: 600,
            borderRadius: 8,
            padding: '0.5rem 1.1rem',
            textDecoration: 'none',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
          }}
        >
          📄 View PDF
        </a>
      </div>
    ));
  }

  const tabs = [
    { key: 'account', label: 'Account Information' },
    { key: 'reports', label: 'Report Cards' },
  ];

  return (
    <main>
      <style
        dangerouslySetInnerHTML={{
          __html: `
    .tab-btn {
      background: none; border: none; padding: 0.75rem 1.3rem; font-size: 0.95rem;
      font-weight: 600; color: #aaa; cursor: pointer; border-bottom: 2px solid transparent;
      margin-bottom: -2px; transition: color 0.2s, border-color 0.2s; white-space: nowrap;
    }
    .tab-btn.active { color: #e8a87c; border-bottom-color: #e8a87c; }
    .tab-btn:hover { color: #6b5b47; }
  `,
        }}
      />

      <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div>
            <h1 style={{ color: '#6b5b47', margin: 0, fontSize: '1.8rem' }}>
              {currentUser ? `Hi, ${currentUser.firstName}!` : ''}
            </h1>
            <p style={{ color: '#aaa', margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
              {currentUser ? currentUser.email : ''}
            </p>
          </div>
          <button
            onClick={logout}
            style={{
              background: '#f5f0eb',
              border: 'none',
              color: '#6b5b47',
              fontWeight: 600,
              borderRadius: 8,
              padding: '0.55rem 1.2rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Log Out
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '2px solid #eee',
            marginBottom: '2rem',
            overflowX: 'auto',
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ACCOUNT TAB */}
        <div style={{ display: activeTab === 'account' ? 'block' : 'none' }}>
          <h2 style={{ color: '#6b5b47', fontSize: '1.15rem', margin: '0 0 1.5rem' }}>Account Information</h2>

          {accountMsg ? (
            <div
              style={
                accountMsg.type === 'success'
                  ? {
                      display: 'block',
                      background: '#e8f5ec',
                      border: '1px solid #7cbf8e',
                      color: '#1e7a40',
                      borderRadius: 8,
                      padding: '0.75rem 1rem',
                      marginBottom: '1.2rem',
                      fontSize: '0.9rem',
                    }
                  : {
                      display: 'block',
                      background: '#fdeaea',
                      border: '1px solid #e88080',
                      color: '#b00',
                      borderRadius: 8,
                      padding: '0.75rem 1rem',
                      marginBottom: '1.2rem',
                      fontSize: '0.9rem',
                    }
              }
            >
              {accountMsg.text}
            </div>
          ) : null}

          <form
            onSubmit={handleAccountSubmit}
            style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 600,
                    color: '#6b5b47',
                    marginBottom: '0.3rem',
                    fontSize: '0.9rem',
                  }}
                >
                  First Name
                </label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.7rem 1rem',
                    border: '1.5px solid #ddd',
                    borderRadius: 8,
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 600,
                    color: '#6b5b47',
                    marginBottom: '0.3rem',
                    fontSize: '0.9rem',
                  }}
                >
                  Last Name
                </label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.7rem 1rem',
                    border: '1.5px solid #ddd',
                    borderRadius: 8,
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontWeight: 600,
                  color: '#6b5b47',
                  marginBottom: '0.3rem',
                  fontSize: '0.9rem',
                }}
              >
                Phone
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem 1rem',
                  border: '1.5px solid #ddd',
                  borderRadius: 8,
                  fontSize: '0.95rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Students */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.8rem',
                }}
              >
                <label style={{ fontWeight: 700, color: '#6b5b47', fontSize: '0.95rem' }}>Students</label>
                <button
                  type="button"
                  onClick={() => addEditStudentRow()}
                  style={{
                    background: '#f5f0eb',
                    border: 'none',
                    color: '#e8a87c',
                    fontWeight: 700,
                    borderRadius: 6,
                    padding: '0.3rem 0.8rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  + Add Student
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {editStudents.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 36px',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Student name"
                      value={s.name}
                      onChange={(e) => updateStudent(i, 'name', e.target.value)}
                      className="edit-student-name"
                      style={{
                        padding: '0.65rem 0.8rem',
                        border: '1.5px solid #ddd',
                        borderRadius: 8,
                        fontSize: '0.9rem',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                    <select
                      value={s.grade}
                      onChange={(e) => updateStudent(i, 'grade', e.target.value)}
                      className="edit-student-grade"
                      style={{
                        padding: '0.65rem 0.5rem',
                        border: '1.5px solid #ddd',
                        borderRadius: 8,
                        fontSize: '0.9rem',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="">Grade</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {gradeLabel(g)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeStudent(i)}
                      style={{
                        background: '#fdeaea',
                        border: 'none',
                        color: '#e88080',
                        borderRadius: 6,
                        fontSize: '1rem',
                        cursor: 'pointer',
                        height: 36,
                        width: 36,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              style={{
                background: '#e8a87c',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '0.75rem',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s',
                maxWidth: 200,
              }}
            >
              Save Changes
            </button>
          </form>
        </div>

        {/* REPORTS TAB */}
        <div style={{ display: activeTab === 'reports' ? 'block' : 'none' }}>
          <h2 style={{ color: '#6b5b47', fontSize: '1.15rem', margin: '0 0 1.2rem' }}>Report Cards</h2>
          <div>{renderReports()}</div>
        </div>
      </div>
    </main>
  );
}
