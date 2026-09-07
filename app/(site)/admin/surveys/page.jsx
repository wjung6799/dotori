'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SurveyDetails from '../SurveyDetails';

// The enrollment-form ledger, student by student: every student any family has
// listed — plus any form whose student has since left the list — with whether
// the form is in and what it said about the media release. Click a column to
// sort (submitted-or-not included, which is how the office chases stragglers);
// click a submitted row to read the whole form in place.

const BROWN = '#6b5b47';
const DARK = '#4a3c28';

function famName(u) {
  if (!u) return 'Family';
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email;
}

// One sortable value per column, per row.
const SORTERS = {
  student: (r) => r.studentName.toLowerCase(),
  family: (r) => r.familyName.toLowerCase(),
  grade: (r) => r.grade || '~', // empty grades sink to the bottom
  submitted: (r) => (r.survey ? 0 : 1), // forms in hand first; flip for stragglers
  media: (r) => (r.survey ? (r.survey.mediaRelease === 'agree' ? 0 : 1) : 2),
  date: (r) => (r.survey?.createdAt ? -new Date(r.survey.createdAt).getTime() : 1),
};

export default function AdminSurveysPage() {
  const [surveys, setSurveys] = useState(null);
  const [families, setFamilies] = useState(null);
  const [openKey, setOpenKey] = useState('');
  const [sort, setSort] = useState({ key: 'submitted', dir: 1 });

  useEffect(() => {
    fetch('/api/admin/surveys')
      .then((r) => r.json())
      .then((d) => setSurveys(d.surveys || []))
      .catch(() => setSurveys([]));
    fetch('/api/admin/families')
      .then((r) => r.json())
      .then((d) => setFamilies(d.families || []))
      .catch(() => setFamilies([]));
  }, []);

  const rows = useMemo(() => {
    if (surveys === null || families === null) return null;
    const out = [];
    const claimed = new Set();
    for (const f of families) {
      for (const s of f.students || []) {
        const survey =
          surveys.find(
            (sv) => String(sv.userId?._id ?? sv.userId) === String(f._id) && sv.studentName === s.name,
          ) || null;
        if (survey) claimed.add(String(survey._id));
        out.push({
          key: `${f._id}|${s.name}`,
          studentName: s.name,
          familyName: famName(f),
          familyEmail: f.email || '',
          grade: survey?.grade || s.grade || '',
          survey,
        });
      }
    }
    // A form whose student is no longer on a family list is still a form the
    // school holds — it must not vanish from the ledger.
    for (const sv of surveys) {
      if (claimed.has(String(sv._id))) continue;
      out.push({
        key: `orphan|${sv._id}`,
        studentName: sv.studentName,
        familyName: famName(sv.userId),
        familyEmail: sv.userId?.email || '',
        grade: sv.grade || '',
        survey: sv,
        orphan: true,
      });
    }
    return out;
  }, [surveys, families]);

  const sorted = useMemo(() => {
    if (!rows) return null;
    const get = SORTERS[sort.key] || SORTERS.student;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : SORTERS.student(a) < SORTERS.student(b) ? -1 : 1;
      return cmp * sort.dir;
    });
  }, [rows, sort]);

  const clickSort = (key) =>
    setSort((prev) => (prev.key === key ? { key, dir: -prev.dir } : { key, dir: 1 }));

  const counts = useMemo(() => {
    if (!rows) return null;
    const submitted = rows.filter((r) => r.survey);
    return {
      students: rows.length,
      submitted: submitted.length,
      missing: rows.length - submitted.length,
      mediaYes: submitted.filter((r) => r.survey.mediaRelease === 'agree').length,
      mediaNo: submitted.filter((r) => r.survey.mediaRelease !== 'agree').length,
    };
  }, [rows]);

  const th = (key, label) => (
    <th
      onClick={() => clickSort(key)}
      title="Sort"
      style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
    >
      {label} {sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <main style={{ marginTop: 72 }}>
      <div className="container" style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '2rem 0 1rem' }}>
          <h1 style={{ color: DARK, fontSize: '1.6rem', margin: 0 }}>Enrollment Forms</h1>
          <Link href="/admin" style={{ color: '#8b7355', fontWeight: 600 }}>← Admin home</Link>
        </div>

        {counts ? (
          <p style={{ color: BROWN, margin: '0 0 1.25rem', fontSize: '0.92rem' }}>
            {counts.students} students · <strong>{counts.submitted}</strong> forms in
            {counts.missing ? <> · <strong style={{ color: '#b5654a' }}>{counts.missing}</strong> missing</> : null}
            {' '}· media release: <strong style={{ color: '#1e7a40' }}>{counts.mediaYes} agreed</strong>
            {counts.mediaNo ? <> / <strong style={{ color: '#b5654a' }}>{counts.mediaNo} declined</strong></> : null}
          </p>
        ) : null}

        {sorted === null ? (
          <p style={{ color: BROWN }}>Loading…</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: BROWN }}>No students yet.</p>
        ) : (
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 14px rgba(139,115,85,0.08)', marginBottom: '3rem' }}>
            <table className="admin-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  {th('student', 'Student')}
                  {th('family', 'Family')}
                  {th('grade', 'Grade')}
                  {th('submitted', 'Form')}
                  {th('media', 'Media release')}
                  {th('date', 'Submitted')}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const open = openKey === r.key && r.survey;
                  return (
                    <SurveyRow
                      key={r.key}
                      row={r}
                      open={open}
                      onToggle={() => r.survey && setOpenKey(open ? '' : r.key)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function SurveyRow({ row: r, open, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: r.survey ? 'pointer' : 'default', background: open ? '#fdfbf8' : undefined }}
        title={r.survey ? 'Click to read the form' : 'No form submitted yet'}
      >
        <td>
          <strong style={{ color: DARK }}>{r.studentName}</strong>
          {r.orphan ? (
            <span style={{ color: '#9b8b77', fontSize: '0.78rem' }}> · no longer on the family&rsquo;s list</span>
          ) : null}
        </td>
        <td>
          {r.familyName}
          {r.familyEmail ? (
            <>
              <br />
              <span style={{ color: '#aaa', fontSize: '0.78rem' }}>{r.familyEmail}</span>
            </>
          ) : null}
        </td>
        <td>{r.grade || '–'}</td>
        <td>
          {r.survey ? (
            <span style={{ color: '#1e7a40', fontWeight: 700 }}>✓ in {open ? '▴' : '▾'}</span>
          ) : (
            <span style={{ color: '#b5654a', fontWeight: 700 }}>missing</span>
          )}
        </td>
        <td>
          {r.survey ? (
            r.survey.mediaRelease === 'agree' ? (
              <span style={{ color: '#1e7a40', fontWeight: 600 }}>agreed</span>
            ) : (
              <span style={{ color: '#b5654a', fontWeight: 600 }}>declined</span>
            )
          ) : (
            '–'
          )}
        </td>
        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          {r.survey?.createdAt ? new Date(r.survey.createdAt).toLocaleDateString() : '–'}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={6} style={{ background: '#fdfbf8', padding: 0 }}>
            <SurveyDetails survey={r.survey} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
