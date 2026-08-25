import Link from 'next/link';
import { redirect } from 'next/navigation';

import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import Enrollment from '@/lib/models/Enrollment';
import EnrollmentSurvey from '@/lib/models/EnrollmentSurvey';
import Feedback from '@/lib/models/Feedback';
import Report from '@/lib/models/Report';
import SessionCredit from '@/lib/models/SessionCredit';
import Class from '@/lib/models/Class'; // registers the model for populate()
import Tutor from '@/lib/models/Tutor'; // registers the model for populate()
import { getCurrentUser } from '@/lib/auth-helpers';

import LocalTime from '../LocalTime';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Overview' };

function gradeLabel(g) {
  if (!g) return '';
  if (g === 'Pre-K') return 'Preschool';
  if (g === 'K') return 'Kindergarten';
  return `Grade ${g}`;
}

// The portal's front page: one screen that answers "where does my family stand
// right now". Every number here is a link into the page that can change it.
// Staff never see this — they get bounced to their own console so each role has
// exactly one landing place.
export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/dashboard');
  if (user.role === 'admin') redirect('/admin/classes');
  if (user.role === 'tutor') redirect('/tutor');

  await dbConnect();
  void Class;
  void Tutor;

  const now = new Date();

  const [credits, upcoming, enrollments, surveys, reports, feedback] = await Promise.all([
    SessionCredit.find({ userId: user._id, remainingSessions: { $gt: 0 } }).lean(),
    Booking.find({ userId: user._id, status: 'scheduled', startAt: { $gte: now } })
      .populate('tutorId', 'name')
      .sort({ startAt: 1 })
      .limit(5)
      .lean(),
    Enrollment.find({ userId: user._id, paymentStatus: { $ne: 'refunded' } })
      .populate('classId', 'name schedule')
      .sort({ enrolledAt: -1 })
      .lean(),
    EnrollmentSurvey.find({ userId: user._id }).select('studentName').lean(),
    Report.find({ userId: user._id }).populate('classId', 'name').sort({ uploadedAt: -1 }).limit(3).lean(),
    Feedback.find({ userId: user._id }).sort({ createdAt: -1 }).limit(2).lean(),
  ]);

  const totalCredits = credits.reduce((sum, c) => sum + (c.remainingSessions || 0), 0);
  const students = (user.students || []).filter((s) => s.name);
  const submittedFor = new Set(surveys.map((s) => s.studentName));
  const firstName = user.firstName || (user.name || '').split(' ')[0] || 'there';

  // Everything still waiting on the family, gathered in one strip so nothing
  // hides at the bottom of a page they never scroll to.
  const todos = [];
  if (students.length === 0) {
    todos.push({
      text: 'Add your student so we can link their classes, reports and bookings.',
      cta: 'Add a student',
      href: '/dashboard/students',
    });
  }
  for (const s of students) {
    if (!submittedFor.has(s.name)) {
      todos.push({
        text: `Enrollment form not submitted for ${s.name}. (${s.name} 등록 신청서 미제출)`,
        cta: 'Fill it out',
        href: `/dashboard/students/enrollment-form?student=${encodeURIComponent(s.name)}`,
      });
    }
  }
  // Class tuition is settled with the office, not in the portal, so the action
  // here is to talk to us — pointing at billing would be a dead end.
  const pendingPayment = enrollments.filter((e) => e.paymentStatus !== 'paid');
  if (pendingPayment.length > 0) {
    todos.push({
      text: `Tuition is outstanding on ${pendingPayment.length} class enrollment${pendingPayment.length === 1 ? '' : 's'}.`,
      cta: 'Contact the school',
      href: '/contact',
    });
  }
  if (totalCredits === 0) {
    todos.push({
      text: 'No session credits left — top up to keep your weekly slot.',
      cta: 'Buy credits',
      href: '/dashboard/credits',
    });
  } else if (upcoming.length === 0) {
    todos.push({
      text: `You have ${totalCredits} session credit${totalCredits === 1 ? '' : 's'} and nothing booked yet.`,
      cta: 'Book a 1:1 session',
      href: '/dashboard/booking',
    });
  }

  const nextSession = upcoming[0] || null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p className="lede">Everything for your family, in one place. (우리 가족 한눈에 보기)</p>
        </div>
        <Link href="/dashboard/booking" className="btn btn-primary">
          Book a 1:1 session
        </Link>
      </div>

      {todos.length > 0 ? (
        <section className="todo">
          <h2>Needs your attention (확인이 필요해요)</h2>
          <ul>
            {todos.map((t) => (
              <li key={t.text}>
                <span>{t.text}</span>
                <Link href={t.href} className="btn btn-accent btn-sm">
                  {t.cta}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid" style={{ marginBottom: '1.1rem' }}>
        <Link href="/dashboard/credits" className="stat" style={{ textDecoration: 'none' }}>
          <div className="label">Session credits (남은 크레딧)</div>
          <div className="value">{totalCredits}</div>
          <div className="hint">{totalCredits > 0 ? 'Ready to book' : 'Buy a pack to get started'}</div>
        </Link>

        <Link href="/dashboard/booking" className="stat" style={{ textDecoration: 'none' }}>
          <div className="label">Next session (다음 수업)</div>
          <div className={`value${nextSession ? ' sm' : ''}`}>
            {nextSession ? <LocalTime iso={new Date(nextSession.startAt).toISOString()} /> : 'None booked'}
          </div>
          <div className="hint">
            {nextSession
              ? `${nextSession.studentName}${nextSession.tutorId?.name ? ` · ${nextSession.tutorId.name}` : ''}`
              : 'Pick an open time'}
          </div>
        </Link>

        <Link href="/dashboard/classes" className="stat" style={{ textDecoration: 'none' }}>
          <div className="label">Enrolled classes (수강 중)</div>
          <div className="value">{enrollments.length}</div>
          <div className="hint">{enrollments.length ? 'See details below' : 'Browse this term'}</div>
        </Link>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Upcoming sessions (예정된 수업)</h2>
          <Link href="/dashboard/booking" className="link">Book or manage →</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">📅</span>
            <p>No 1:1 sessions booked yet. Pick an open time on the booking page.</p>
          </div>
        ) : (
          <div className="stack">
            {upcoming.map((b) => (
              <div className="row" key={String(b._id)}>
                <span className="main">
                  <span className="strong">
                    <LocalTime iso={new Date(b.startAt).toISOString()} />
                  </span>
                  <span className="meta">
                    {' · '}
                    {b.studentName}
                    {b.tutorId?.name ? ` · ${b.tutorId.name}` : ''}
                  </span>
                </span>
                <span className={`pill ${b.kind === 'diagnostic' ? 'info' : b.isPrivate ? 'info' : 'ok'}`}>
                  {b.kind === 'diagnostic' ? 'Assessment' : b.isPrivate ? 'Private' : 'Scheduled'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Your students (우리 아이)</h2>
          <Link href="/dashboard/students" className="link">Manage students →</Link>
        </div>
        {students.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">🌱</span>
            <p>No students saved yet. Add one so classes and reports can be linked to them.</p>
          </div>
        ) : (
          <div className="grid">
            {students.map((s) => {
              const theirClasses = enrollments.filter((en) => en.studentName === s.name);
              const submitted = submittedFor.has(s.name);
              return (
                <div
                  key={s.name}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-soft)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.9rem 1.05rem',
                  }}
                >
                  <div className="strong" style={{ fontSize: '1.02rem' }}>{s.name}</div>
                  {s.grade ? <div className="muted small">{gradeLabel(s.grade)}</div> : null}

                  <div style={{ margin: '0.55rem 0' }}>
                    <span className={`pill ${submitted ? 'ok' : 'warn'}`}>
                      {submitted ? 'Form submitted' : 'Form missing'}
                    </span>
                  </div>

                  {theirClasses.length === 0 ? (
                    <div className="muted small">No classes enrolled.</div>
                  ) : (
                    <div className="small" style={{ color: 'var(--ink-2)' }}>
                      {theirClasses.map((en) => (
                        <div key={String(en._id)}>
                          • {en.classId?.name || 'Class'}
                          {en.classId?.schedule ? <span className="muted"> · {en.classId.schedule}</span> : null}
                          {en.paymentStatus === 'paid' ? null : (
                            <span style={{ color: 'var(--warn)', fontWeight: 700 }}> · payment pending</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Recent report cards (성적표)</h2>
            <Link href="/dashboard/reports" className="link">See all →</Link>
          </div>
          {reports.length === 0 ? (
            <div className="empty">
              <span className="ico" aria-hidden="true">📄</span>
              <p>Reports appear here once your teacher uploads them.</p>
            </div>
          ) : (
            <div className="stack">
              {reports.map((r) => (
                <div className="row" key={String(r._id)}>
                  <span className="main">
                    <span className="strong">{r.studentName}</span>
                    <span className="meta"> · {r.title}</span>
                  </span>
                  <a href={r.pdfPath} target="_blank" rel="noreferrer" className="link">
                    View PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Recent feedback (선생님 피드백)</h2>
            <Link href="/dashboard/reports" className="link">See all →</Link>
          </div>
          {feedback.length === 0 ? (
            <div className="empty">
              <span className="ico" aria-hidden="true">💬</span>
              <p>Your instructor&rsquo;s notes will show up here.</p>
            </div>
          ) : (
            <div className="stack">
              {feedback.map((f) => (
                <div
                  key={String(f._id)}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line-soft)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.7rem 0.95rem',
                  }}
                >
                  <div className="meta small">
                    {f.studentName ? `${f.studentName} · ` : ''}
                    {f.tutorName || 'Dotori School'} ·{' '}
                    <LocalTime iso={new Date(f.createdAt).toISOString()} format="date" />
                  </div>
                  <div style={{ color: 'var(--ink-2)' }}>
                    {f.text.length > 220 ? `${f.text.slice(0, 220)}…` : f.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
