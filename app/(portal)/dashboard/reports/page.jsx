import { redirect } from 'next/navigation';

import dbConnect from '@/lib/db';
import Report from '@/lib/models/Report';
import Feedback from '@/lib/models/Feedback';
import Class from '@/lib/models/Class'; // registers the model for populate()
import { getCurrentUser } from '@/lib/auth-helpers';

import LocalTime from '../../LocalTime';
import FeedbackThread from '../../FeedbackThread';

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

// "2026-09-24" → "Sep 24". A lesson date is a plain calendar day, so it is
// built in UTC from its parts rather than shifted through a timezone.
function lessonLabel(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
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
    Feedback.find({ userId: user._id }).populate('classId', 'name').sort({ createdAt: -1 }).limit(200).lean(),
  ]);

  // Notes grouped by child, newest first inside each group. A note without a
  // student name goes under the family's own heading so nothing is hidden.
  const groups = [];
  for (const f of feedback) {
    const key = (f.studentName || '').trim().toLowerCase() || '__family';
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: (f.studentName || '').trim() || 'Your family', notes: [] };
      groups.push(g);
    }
    g.notes.push(f);
  }
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports &amp; feedback</h1>
          <p className="lede">
            Report cards and notes from your instructors, all in one place.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Report cards</h2>
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
          <h2>Feedback</h2>
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
          <div className="stack" style={{ gap: '1.4rem' }}>
            {groups.map((g) => (
              <section key={g.key}>
                {groups.length > 1 || g.key === '__family' ? (
                  <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem' }}>
                    {g.label}
                    <span className="muted small" style={{ fontWeight: 400, marginLeft: '0.5rem' }}>
                      {g.notes.length} {g.notes.length === 1 ? 'note' : 'notes'}
                    </span>
                  </h3>
                ) : null}
                <div className="stack">
                  {g.notes.map((f) => {
                    const written = iso(f.createdAt);
                    const isNew = f.createdAt && new Date(f.createdAt).getTime() > weekAgo;
                    const where = [f.classId?.name, f.lessonDate ? `lesson on ${lessonLabel(f.lessonDate)}` : ''].filter(Boolean).join(' · ');
                    return (
                      <div className="row" key={String(f._id)}>
                        {/* Full width so the note reads as a block, not a two-column row —
                            this is the page where parents actually read the whole thing. */}
                        <div className="main" style={{ flex: '1 1 100%' }}>
                          <div className="meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', alignItems: 'baseline' }}>
                            {where ? <span className="strong">{where}</span> : null}
                            <span>
                              {f.tutorName || 'Dotori School'}
                              {written ? (
                                <>
                                  {' · '}
                                  <LocalTime iso={written} format="date" />
                                </>
                              ) : null}
                            </span>
                            {isNew ? <span className="pill ok">New</span> : null}
                          </div>
                          <p className="mb0" style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>
                            {f.text}
                          </p>
                          <FeedbackThread
                            endpoint={`/api/feedback/${f._id}/replies`}
                            viewer="family"
                            otherName={f.tutorName}
                            replies={(f.replies || []).map((r) => ({
                              _id: String(r._id),
                              from: r.from,
                              authorName: r.authorName,
                              text: r.text,
                              createdAt: iso(r.createdAt),
                            }))}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
