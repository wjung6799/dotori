import DiagnosticBooking from './DiagnosticBooking';
import { getGlobal } from '@/lib/cms';

export const metadata = {
  title: 'Book a Free Diagnostic Assessment | Dotori School Bellevue',
  description:
    'Book a free 30–45 minute diagnostic assessment at Dotori School in Bellevue. We show you exactly where your child stands and build a concrete plan. Personalized, in small groups, no obligation.',
};

export const dynamic = 'force-dynamic';

export default async function DiagnosticPage() {
  const c = await getGlobal('diagnosticPage');
  const STEPS = c.steps || [];
  return (
    <main>
      <div className="container" style={{ maxWidth: 820, margin: '0 auto' }}>
        <div className="page-header" style={{ padding: '3rem 1.5rem' }}>
          <h1>{c.heading}</h1>
          <p>{c.intro}</p>
        </div>

        {/* How it works */}
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '2.5rem' }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: '1.5rem', boxShadow: '0 10px 20px rgba(139,115,85,0.08)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #8b7355, #a0856b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, marginBottom: '0.75rem' }}>
                {s.n}
              </div>
              <h3 style={{ color: '#4a3c28', fontSize: '1.1rem', marginBottom: '0.4rem' }}>{s.title}</h3>
              <p style={{ color: '#6b5b47', fontSize: '0.95rem' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <DiagnosticBooking />

        <p style={{ textAlign: 'center', color: '#9b8b77', margin: '1.5rem auto 3rem', maxWidth: 560 }}>
          Prefer to talk first? Email{' '}
          <a href="mailto:info@dotorischool.org" style={{ color: '#8b7355', fontWeight: 600 }}>info@dotorischool.org</a>.
          Dotori School, 12721 NE Bel-Red Rd #220, Bellevue.
        </p>
      </div>
    </main>
  );
}
