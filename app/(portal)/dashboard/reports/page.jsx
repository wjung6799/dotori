import { redirect } from 'next/navigation';

import dbConnect from '@/lib/db';
import Report from '@/lib/models/Report';
import Feedback from '@/lib/models/Feedback';
import Class from '@/lib/models/Class'; // registers the model for populate()
import { getCurrentUser } from '@/lib/auth-helpers';

import LocalTime from '../../LocalTime';

// Rendered per request against the signed-in family's own documents, so there is
// never a stale report card cached from another session.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reports & feedback',
  robots: { index: false, follow: false },
};


// Unknown quarters fall through to the raw value rather than an empty cell —
// admins type these by hand, so a new term should still be readable here.
function quarterLabel(q) {
    // Derived, not hand-listed, so a new term never shows a parent its raw slug.
  const [season, year] = String(q).split('-');
  if (!year) return q || '—';
  return season.charAt(0).toUpperCase() + season.slice(1) + ' ' + year;
}

// .lean() hands back real Date objects; LocalTime needs an ISO string.
function iso(d) {
  if (!d) return null;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/dashboard/reports');

  await dbConnect();
  void Class; // must be registered before .populate('classId', ...)

  const [reports, feedback] = await Promise.all([
    Report.find({ userId: user._id })
      .populate('classId', 'name')
      .sort({ uploadedAt: -1 })
      .lean(),
    Feedback.find({ userId: user._id }).sort({ createdAt: -1 }).limit(200).lean(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports &amp; feedback</h1>
          <p className="lede">
            Report cards (성적표) and notes from your instructors, all in one place.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Report cards (성적표)</h2>
          {reports.length > 0 ? (
            <span className="muted small nowrap">
              {reports.length} {reports.length === 1 ? 'report' : 'reports'}
            </span>
          ) : null}
        </div>

        {reports.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">📄</span>
            <p>No report cards yet. They appear here as soon as your teacher uploads one.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Report</th>
                  <th>Quarter</th>
                  <th>Uploaded</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const uploaded = iso(r.uploadedAt);
                  return (
                    <tr key={String(r._id)}>
                      <td className="strong">{r.studentName}</td>
                      <td>
                        {r.title}
                        {r.classId?.name ? (
                          <div className="muted small">{r.classId.name}</div>
                        ) : null}
                      </td>
                      <td className="nowrap">{quarterLabel(r.quarter)}</td>
                      <td className="nowrap">
                        {uploaded ? <LocalTime iso={uploaded} format="date" /> : '—'}
                      </td>
                      <td className="num">
                        <a href={r.pdfPath} target="_blank" rel="noreferrer" className="nowrap">
                          View PDF
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Feedback (선생님 피드백)</h2>
          {feedback.length > 0 ? (
            <span className="muted small nowrap">
              {feedback.length} {feedback.length === 1 ? 'note' : 'notes'}
            </span>
          ) : null}
        </div>

        {feedback.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">💬</span>
            <p>No feedback yet. Your instructor&rsquo;s notes will show up here after class.</p>
          </div>
        ) : (
          <div className="stack">
            {feedback.map((f) => {
              const written = iso(f.createdAt);
              return (
                <div className="row" key={String(f._id)}>
                  {/* Full width so the note reads as a block, not a two-column row —
                      this is the page where parents actually read the whole thing. */}
                  <div className="main" style={{ flex: '1 1 100%' }}>
                    <div className="meta">
                      {f.studentName ? `${f.studentName} · ` : ''}
                      {f.tutorName || 'Dotori School'}
                      {written ? (
                        <>
                          {' · '}
                          <LocalTime iso={written} format="date" />
                        </>
                      ) : null}
                    </div>
                    <p className="mb0" style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>
                      {f.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
