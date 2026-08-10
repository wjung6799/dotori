import Link from 'next/link';
import { getGlobal, getTeam } from '@/lib/cms';

// Real parent testimonials go here (e.g. pulled from the Google Business Profile).
// Leave empty and the section stays hidden; we never ship placeholder quotes.
// Shape: { quote, name, detail }  e.g. { quote: '…', name: 'Grace K.', detail: '★★★★★ · Google' }
const TESTIMONIALS = [];

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const c = await getGlobal('homePage');
  const founders = await getTeam({ homeOnly: true });
  const TRUST = (c.trustItems || []).map((t) => [t.title, t.body]);
  return (
    <>
      {/* JSON-LD for local SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'EducationalOrganization',
            name: 'Dotori School',
            description:
              'Personalized literacy & math tutoring in Bellevue, with a lesson plan built for each student.',
            url: 'https://dotorischool.org',
            email: 'info@dotorischool.org',
            address: {
              '@type': 'PostalAddress',
              streetAddress: '12721 NE Bel-Red Rd #220',
              addressLocality: 'Bellevue',
              addressRegion: 'WA',
              postalCode: '98005',
              addressCountry: 'US',
            },
          }),
        }}
      />

      {/* Hero */}
      <section
        className="hero"
        style={{
          background: 'linear-gradient(135deg, #f8f6f3 0%, #efe7dd 100%)',
          padding: '72px 0 48px',
          color: '#6b5b47',
          textAlign: 'center',
          marginTop: 56,
        }}
      >
        <div className="container" style={{ maxWidth: 860 }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.15, color: '#4a3c28', whiteSpace: 'pre-line' }}>
            {c.heroHeading}
          </h1>
          <p style={{ fontSize: '1.35rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            {c.heroSubtitle}
          </p>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: '#6b5b47' }}>
            {c.heroSubtitle2}
          </p>
          <Link
            href="/contact"
            className="btn btn-primary"
            style={{ padding: '1rem 2.5rem', fontSize: '1.15rem', flex: 'none', display: 'inline-block' }}
          >
            {c.heroCtaText}
          </Link>
          <img
            src={c.heroImage?.url || '/assets/images/hero-image.png'}
            alt="Dotori School, personalized literacy and math tutoring in Bellevue"
            style={{ display: 'block', maxWidth: '68%', height: 'auto', borderRadius: 12, margin: '2.5rem auto 0' }}
          />
        </div>
      </section>

      {/* Two doors */}
      <section className="container" style={{ margin: '56px auto 40px' }}>
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {/* Literacy */}
          <div style={doorCard()}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📖</div>
            <h2 style={{ color: '#4a3c28', marginBottom: '0.5rem' }}>{c.languageTitle}</h2>
            <p style={{ color: '#6b5b47', marginBottom: '1.25rem' }}>
              {c.languageBody}
            </p>
            <Link href="/programs" className="btn btn-secondary" style={{ display: 'inline-block', flex: 'none', padding: '0.7rem 1.75rem' }}>
              Explore Literacy →
            </Link>
          </div>
          {/* Math & Test Prep */}
          <div style={doorCard()}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📐</div>
            <h2 style={{ color: '#4a3c28', marginBottom: '0.5rem' }}>{c.mathTitle}</h2>
            <p style={{ color: '#6b5b47', marginBottom: '1.25rem' }}>
              {c.mathBody}
            </p>
            <Link href="/math" className="btn btn-secondary" style={{ display: 'inline-block', flex: 'none', padding: '0.7rem 1.75rem' }}>
              Explore Math &amp; Test Prep →
            </Link>
          </div>
        </div>
      </section>

      {/* Trust band */}
      <section className="container" style={{ margin: '40px auto' }}>
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {TRUST.map(([title, body]) => (
            <div key={title} style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 16, padding: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ color: '#8b7355', fontSize: '1.1rem', marginBottom: '0.4rem' }}>{title}</h3>
              <p style={{ color: '#6b5b47', fontSize: '0.95rem' }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founders */}
      <section className="container" style={{ maxWidth: 1000, margin: '56px auto' }}>
        <h2 style={{ textAlign: 'center', color: '#4a3c28', marginBottom: '2rem' }}>{c.foundersHeading}</h2>
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {founders.map((f) => (
            <FounderCard
              key={f.id}
              img={f.photo?.url || f.photoUrl}
              name={f.name}
              role={f.role}
              body={f.homeBlurb}
              imgPosition={f.imgPosition || 'center'}
            />
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/team" style={{ color: '#8b7355', fontWeight: 600 }}>Read more about our team →</Link>
        </p>
      </section>

      {/* Testimonials (only renders once real quotes are added above) */}
      {TESTIMONIALS.length > 0 && (
        <section className="container" style={{ maxWidth: 1000, margin: '56px auto' }}>
          <h2 style={{ textAlign: 'center', color: '#4a3c28', marginBottom: '2rem' }}>What families say</h2>
          <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {TESTIMONIALS.map((t, i) => (
              <figure key={i} style={{ background: '#fff', borderRadius: 16, padding: '1.75rem', boxShadow: '0 8px 20px rgba(139,115,85,0.08)', margin: 0 }}>
                <blockquote style={{ color: '#4a3c28', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                  “{t.quote}”
                </blockquote>
                <figcaption style={{ color: '#6b5b47', fontWeight: 600 }}>
                  {t.name}
                  {t.detail ? <span style={{ display: 'block', fontWeight: 400, color: '#9b8b77', fontSize: '0.88rem' }}>{t.detail}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Closing CTA */}
      <section style={{ background: 'linear-gradient(135deg, #f8f6f3 0%, #efe7dd 100%)', padding: '56px 0', textAlign: 'center', marginTop: 40 }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <h2 style={{ color: '#4a3c28', marginBottom: '0.75rem' }}>{c.closingHeading}</h2>
          <p style={{ color: '#6b5b47', fontSize: '1.1rem' }}>
            {c.closingBody}
          </p>
        </div>
      </section>
    </>
  );
}

function FounderCard({ img, name, role, body, imgPosition = 'center' }) {
  return (
    <div style={{ background: '#fff8f0', borderRadius: 18, padding: '2rem', boxShadow: '0 8px 20px rgba(139,115,85,0.08)', textAlign: 'center' }}>
      <img
        src={img}
        alt={name}
        style={{ width: 128, height: 128, borderRadius: '50%', objectFit: 'cover', objectPosition: imgPosition, margin: '0 auto 1rem' }}
      />
      <h3 style={{ color: '#4a3c28', marginBottom: '0.2rem' }}>{name}</h3>
      <div style={{ color: '#8b7355', fontWeight: 600, marginBottom: '0.9rem' }}>{role}</div>
      <p style={{ color: '#6b5b47', textAlign: 'left' }}>{body}</p>
    </div>
  );
}

const doorCard = () => ({
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 20,
  padding: '2.5rem',
  boxShadow: '0 15px 30px rgba(139,115,85,0.1)',
  textAlign: 'center',
});
