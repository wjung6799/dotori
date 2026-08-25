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

import LocalTime from './LocalTime';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard | Dotori School',
  robots: { index: false, follow: false },
};

const BROWN = '#6b5b47';
const DARK = '#4a3c28';
const ACCENT = '#e8a87c';
const MUTED = '#9b8b77';

function gradeLabel(g) {
  if (!g) return '';
  if (g === 'Pre-K') return 'Preschool';
  if (g === 'K') return 'Kindergarten';
  return `Grade ${g}`;
}

// The dashboard is the post-login home for families. Admins and instructors get
// bounced to their own consoles so every role has exactly one landing place.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/dashboard');
  if (user.role === 'admin') redirect('/admin');
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
    Feedback.find({ userId: user._id }).sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  const totalCredits = credits.reduce((sum, c) => sum + (c.remainingSessions || 0), 0);
  const students = (user.students || []).filter((s) => s.name);
  const submittedFor = new Set(surveys.map((s) => s.studentName));
  const firstName = user.firstName || (user.name || '').split(' ')[0] || 'there';

  // ── Action items: everything the family still needs to do, in one strip ──
  const todos = [];
  if (students.length === 0) {
    todos.push({
      text: 'Add your student to your account so we can link classes, reports, and bookings.',
      cta: 'Add a student',
      href: '/profile',
    });
  }
  for (const s of students) {
    if (!submittedFor.has(s.name)) {
      todos.push({
        text: `Enrollment form not submitted for ${s.name}. (${s.name} 등록 신청서 미제출)`,
        cta: 'Fill it out',
        href: `/profile/enrollment-survey?student=${encodeURIComponent(s.name)}`,
      });
    }
  }
  if (totalCredits === 0 && upcoming.length === 0) {
    todos.push({
      text: 'No session credits left. Get in touch to add more and keep your weekly slot.',
      cta: 'Contact us',
      href: '/contact',
    });
  } else if (totalCredits > 0 && upcoming.length === 0) {
    todos.push({
      text: `You have ${totalCredits} session credit${totalCredits === 1 ? '' : 's'} and nothing booked yet.`,
      cta: 'Book a session',
      href: '/schedule',
    });
  }

  const nextSession = upcoming[0] || null;

  return (
    <main>
      <div className="container" style={{ maxWidth: 1040, margin: '0 auto' }}>
        {/* Greeting */}
        <div style={{ padding: '2.5rem 0 1.5rem' }}>
          <h1 style={{ color: DARK, margin: '0 0 0.35rem', fontSize: '2rem' }}>
            Welcome back, {firstName}
          </h1>
          <p style={{ color: MUTED, margin: 0, fontSize: '1.02rem' }}>
            Everything for your family, in one place. (우리 가족 한눈에 보기)
          </p>
        </div>

        {/* Action items */}
        {todos.length > 0 ? (
          <section
            style={{
              background: '#fff8f0',
              border: `1px solid ${ACCENT}55`,
              borderRadius: 16,
              padding: '1.25rem 1.5rem',
              marginBottom: '1.75rem',
            }}
          >
            <h2 style={{ color: DARK, fontSize: '1rem', margin: '0 0 0.8rem' }}>
              Needs your attention (확인이 필요해요)
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {todos.map((t) => (
                <li
                  key={t.text}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: BROWN, fontSize: '0.95rem' }}>{t.text}</span>
                  <Link
                    href={t.href}
                    style={{
                      background: ACCENT,
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      borderRadius: 8,
                      padding: '0.45rem 1rem',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.cta}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* At a glance */}
        <section
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            marginBottom: '2rem',
          }}
        >
          <StatCard label="Session credits (남은 크레딧)" value={totalCredits} hint={
            totalCredits > 0 ? 'Ready to book' : 'Contact us to add more'
          } />
          <StatCard
            label="Next session (다음 수업)"
            value={nextSession ? <LocalTime iso={new Date(nextSession.startAt).toISOString()} /> : 'None booked'}
            small={!!nextSession}
            hint={
              nextSession
                ? `${nextSession.studentName}${nextSession.tutorId?.name ? ` · ${nextSession.tutorId.name}` : ''}`
                : 'Pick a time on the schedule'
            }
          />
          <StatCard
            label="Enrolled classes (수강 중)"
            value={enrollments.length}
            hint={enrollments.length ? 'See details below' : 'Browse our programs'}
          />
        </section>

        {/* Upcoming sessions */}
        <Panel title="Upcoming sessions (예정된 수업)" action={{ href: '/schedule', label: 'Book / manage →' }}>
          {upcoming.length === 0 ? (
            <Empty icon="📅" text="No sessions booked yet. Pick an open time on the schedule." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {upcoming.map((b) => (
                <Row key={String(b._id)}>
                  <span style={{ color: DARK, fontSize: '0.95rem' }}>
                    <strong>
                      <LocalTime iso={new Date(b.startAt).toISOString()} />
                    </strong>
                    <span style={{ color: MUTED }}>
                      {' · '}
                      {b.studentName}
                      {b.tutorId?.name ? ` · ${b.tutorId.name}` : ''}
                    </span>
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: b.isPrivate ? '#7a4fb3' : '#1e7a40', whiteSpace: 'nowrap' }}>
                    {b.kind === 'diagnostic' ? 'Diagnostic' : b.isPrivate ? 'Private' : 'Scheduled'}
                  </span>
                </Row>
              ))}
            </div>
          )}
        </Panel>

        {/* Students */}
        <Panel title="Your students (우리 아이)" action={{ href: '/profile', label: 'Edit account →' }}>
          {students.length === 0 ? (
            <Empty icon="🌱" text="No students saved yet. Add one in your account settings." />
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {students.map((s) => {
                const theirClasses = enrollments.filter((en) => en.studentName === s.name);
                const submitted = submittedFor.has(s.name);
                return (
                  <div
                    key={s.name}
                    style={{
                      background: '#faf7f3',
                      borderRadius: 14,
                      padding: '1.1rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    <div>
                      <div style={{ color: DARK, fontWeight: 700, fontSize: '1.05rem' }}>{s.name}</div>
                      {s.grade ? (
                        <div style={{ color: MUTED, fontSize: '0.85rem' }}>{gradeLabel(s.grade)}</div>
                      ) : null}
                    </div>

                    <div style={{ fontSize: '0.85rem' }}>
                      <span style={{ color: MUTED }}>Enrollment form: </span>
                      <span style={{ fontWeight: 700, color: submitted ? '#1e7a40' : '#a3261a' }}>
                        {submitted ? 'Submitted ✓' : 'Not submitted'}
                      </span>
                      {submitted ? null : (
                        <>
                          {' · '}
                          <Link
                            href={`/profile/enrollment-survey?student=${encodeURIComponent(s.name)}`}
                            style={{ color: '#8b7355', fontWeight: 700 }}
                          >
                            Fill out
                          </Link>
                        </>
                      )}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: BROWN }}>
                      {theirClasses.length === 0 ? (
                        <span style={{ color: MUTED }}>No classes enrolled.</span>
                      ) : (
                        theirClasses.map((en) => (
                          <div key={String(en._id)}>
                            • {en.classId?.name || 'Class'}
                            {en.classId?.schedule ? (
                              <span style={{ color: MUTED }}> · {en.classId.schedule}</span>
                            ) : null}
                            {en.paymentStatus === 'paid' ? null : (
                              <span style={{ color: '#b3622e', fontWeight: 700 }}> · payment pending</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Reports + feedback */}
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <Panel title="Recent report cards (성적표)" action={{ href: '/profile?tab=reports', label: 'See all →' }}>
            {reports.length === 0 ? (
              <Empty icon="📄" text="Reports appear here once your teacher uploads them." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {reports.map((r) => (
                  <Row key={String(r._id)}>
                    <span style={{ color: DARK, fontSize: '0.92rem' }}>
                      <strong>{r.studentName}</strong>
                      <span style={{ color: MUTED }}> · {r.title}</span>
                    </span>
                    <a
                      href={r.pdfPath}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#8b7355', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                      View PDF
                    </a>
                  </Row>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Recent feedback (선생님 피드백)" action={{ href: '/profile?tab=feedback', label: 'See all →' }}>
            {feedback.length === 0 ? (
              <Empty icon="💬" text="Your instructor's notes will show up here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {feedback.map((f) => (
                  <div key={String(f._id)} style={{ background: '#faf7f3', borderRadius: 10, padding: '0.75rem 1rem' }}>
                    <div style={{ color: MUTED, fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                      {f.studentName ? `${f.studentName} · ` : ''}
                      {f.tutorName || 'Dotori School'} ·{' '}
                      <LocalTime iso={new Date(f.createdAt).toISOString()} format="date" />
                    </div>
                    <div style={{ color: BROWN, fontSize: '0.92rem', lineHeight: 1.5 }}>
                      {f.text.length > 220 ? `${f.text.slice(0, 220)}…` : f.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Quick links */}
        <section style={{ margin: '1.5rem 0 3rem' }}>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <QuickLink href="/schedule" icon="🗓️" label="Book a session" />
            <QuickLink href="/calendar" icon="📆" label="Academic calendar" />
            <QuickLink href="/store" icon="🛍️" label="Store" />
            <QuickLink href="/profile" icon="⚙️" label="Account settings" />
            <QuickLink href="/contact" icon="✉️" label="Contact us" />
          </div>
        </section>
      </div>
    </main>
  );
}

/* ── Small presentational helpers ─────────────────────────────── */

function StatCard({ label, value, hint, small = false }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '1.25rem 1.4rem',
        boxShadow: '0 8px 20px rgba(139,115,85,0.08)',
      }}
    >
      <div style={{ color: MUTED, fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ color: DARK, fontSize: small ? '1.1rem' : '1.9rem', fontWeight: 800, lineHeight: 1.25 }}>
        {value}
      </div>
      {hint ? <div style={{ color: MUTED, fontSize: '0.82rem', marginTop: '0.3rem' }}>{hint}</div> : null}
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: '1.5rem',
        boxShadow: '0 8px 20px rgba(139,115,85,0.08)',
        marginBottom: '1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.35rem 1rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ color: DARK, fontSize: '1.1rem', margin: 0 }}>{title}</h2>
        {action ? (
          <Link href={action.href} style={{ color: '#8b7355', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Row({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        background: '#faf7f3',
        borderRadius: 10,
        padding: '0.7rem 1rem',
      }}
    >
      {children}
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: MUTED }}>
      <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '0.92rem' }}>{text}</p>
    </div>
  );
}

function QuickLink({ href, icon, label }) {
  return (
    <Link
      href={href}
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '0.9rem 1rem',
        boxShadow: '0 6px 14px rgba(139,115,85,0.07)',
        color: DARK,
        fontWeight: 600,
        fontSize: '0.9rem',
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
      }}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </Link>
  );
}
