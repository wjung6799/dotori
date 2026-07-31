import Link from 'next/link';
import { getGlobal } from '@/lib/cms';

export const metadata = {
  title: 'Math Tutoring & Test Prep in Bellevue | AMC, Physics, Coding | Dotori School',
  description:
    'Personalized math and test prep in Bellevue. Small groups, each on their own plan. School math, AMC competition math, physics, and Python coding. Free diagnostic assessment. Daytime slots for homeschoolers.',
};

export const dynamic = 'force-dynamic';

export default async function MathPage() {
  const c = await getGlobal('mathPage');
  const PROGRAMS = c.programs || [];
  const CALENDAR = (c.calendar || []).map((r) => [r.label, r.when]);

  return (
    <main>
      <div className="container">
        <div className="page-header">
          <h1>{c.heading}</h1>
          <p>{c.intro}</p>
          <div style={{ marginTop: '1.5rem' }}>
            <Link href="/diagnostic" className="btn btn-primary" style={{ padding: '0.9rem 2.25rem', fontSize: '1.05rem', flex: 'none', display: 'inline-block' }}>
              {c.ctaText}
            </Link>
          </div>
        </div>

        {/* Not a worksheet center */}
        <div className="learning-path">
          <h2 style={{ fontSize: '1.9rem' }}>{c.notWorksheetHeading}</h2>
          <p style={{ color: '#6b5b47', fontSize: '1.1rem', maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
            {c.notWorksheetBody}
          </p>
          <p style={{ color: '#6b5b47', textAlign: 'center', marginTop: '1rem', fontStyle: 'italic' }}>
            {c.instructorNote}
          </p>
        </div>

        {/* Programs */}
        <div className="programs-grid">
          {PROGRAMS.map((p) => (
            <div key={p.title} className="program-card" style={p.lead ? { border: '2px solid #8b7355' } : undefined}>
              <div className="program-badge">{p.tag}</div>
              <h3>{p.title}</h3>
              <div className="program-duration">{p.duration}</div>
              <ul className="program-features">
                {(p.features || []).map((f, i) => <li key={i}>{f.text}</li>)}
              </ul>
              <div className="program-cta">
                <Link href="/diagnostic" className="btn btn-primary" style={{ width: '100%', textAlign: 'center' }}>
                  Book a Free Diagnostic
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Calendar hooks (also shown on the Calendar page) */}
        <div className="faq-section">
          <h2>{c.calendarHeading}</h2>
          <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 640, margin: '0 auto' }}>
            {CALENDAR.map(([label, when]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 0', borderBottom: '1px solid rgba(139,115,85,0.12)' }}>
                <span style={{ fontWeight: 600, color: '#4a3c28' }}>{label}</span>
                <span style={{ color: '#6b5b47', textAlign: 'right' }}>{when}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Homeschool line */}
        <div style={{ background: 'rgba(255,255,255,0.75)', borderRadius: 16, padding: '1.5rem 2rem', margin: '2rem 0', textAlign: 'center', color: '#6b5b47' }}>
          {c.homeschoolNote}
        </div>

        {/* Bottom note */}
        <div style={{ textAlign: 'center', margin: '1rem auto 3rem' }}>
          <p style={{ color: '#6b5b47', fontSize: '1.1rem' }}>
            {c.bottomCtaBody}
          </p>
        </div>
      </div>
    </main>
  );
}
