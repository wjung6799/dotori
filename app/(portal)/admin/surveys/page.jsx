'use client';

import { useEffect, useMemo, useState } from 'react';
import SurveyDetails from '../SurveyDetails';

// The enrollment-form ledger, student by student: every student any family has
// listed — plus any form whose student has since left the list — with whether
// the form is in and what it said about the media release. Click a column to
// sort (submitted-or-not included, which is how the office chases stragglers);
// click a submitted row to read the whole form in place.

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

  // portal.css has no sortable-header affordance, so the cursor + arrows stay inline.
  const th = (key, label) => (
    <th
      onClick={() => clickSort(key)}
      title="Sort"
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {label} {sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Enrollment forms</h1>
          {counts ? (
            <p className="lede">
              {counts.students} students · <strong>{counts.submitted}</strong> forms in
              {counts.missing ? <> · <strong>{counts.missing}</strong> missing</> : null}
              {' '}· media release: <strong>{counts.mediaYes} agreed</strong>
              {counts.mediaNo ? <> / <strong>{counts.mediaNo} declined</strong></> : null}
            </p>
          ) : (
            <p className="lede">Which enrollment forms are in, student by student.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Students</h2>
        </div>

        {sorted === null ? (
          <p className="muted mb0">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="empty">
            <span className="ico">📋</span>
            <p>No students yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
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
    </>
  );
}

function SurveyRow({ row: r, open, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: r.survey ? 'pointer' : 'default', background: open ? 'var(--surface-2)' : undefined }}
        title={r.survey ? 'Click to read the form' : 'No form submitted yet'}
      >
        <td>
          <span className="strong">{r.studentName}</span>
          {r.orphan ? (
            <span className="muted small"> · no longer on the family&rsquo;s list</span>
          ) : null}
        </td>
        <td>
          <div>{r.familyName}</div>
          {r.familyEmail ? <div className="muted small">{r.familyEmail}</div> : null}
        </td>
        <td>{r.grade || '–'}</td>
        <td className="nowrap">
          {r.survey ? (
            <>
              <span className="pill ok">✓ in</span>
              <span className="muted small"> {open ? '▴' : '▾'}</span>
            </>
          ) : (
            <span className="pill err">missing</span>
          )}
        </td>
        <td>
          {r.survey ? (
            r.survey.mediaRelease === 'agree' ? (
              <span className="pill ok">agreed</span>
            ) : (
              <span className="pill warn">declined</span>
            )
          ) : (
            '–'
          )}
        </td>
        <td className="small nowrap">
          {r.survey?.createdAt ? new Date(r.survey.createdAt).toLocaleDateString() : '–'}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={6} style={{ background: 'var(--surface-2)', padding: 0 }}>
            <SurveyDetails survey={r.survey} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
