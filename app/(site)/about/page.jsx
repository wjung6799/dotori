import { getGlobal, getTeam } from '@/lib/cms';

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const c = await getGlobal('aboutPage');
  const team = await getTeam();
  // The "Meet the Founder" narrative belongs to Yesol (the member with an
  // aboutNarrative filled in); fall back to the first member.
  const founder = team.find((m) => m.aboutNarrative) || team[0] || {};

  return (
    <>
      {/* Dotori About Section */}
      <section className="container" style={{ margin: '48px auto 48px auto', maxWidth: 900 }}>
        <div
          className="about-dotori-card"
          style={{
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            padding: '2.5rem 2rem',
            marginBottom: '2.5rem',
          }}
        >
          <h1 style={{ textAlign: 'center', color: '#6b5b47', marginBottom: '1.5rem' }}>
            {c.idealForHeading}
          </h1>
          <div style={{ fontSize: '1.15rem', color: '#444', textAlign: 'left' }}>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem', lineHeight: 1.8 }}>
              {(c.idealForItems || []).map((it, i) => (
                <li key={i}>{it.text}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      {/* End Dotori About Section */}

      {/* Our core Values section */}
      <section className="container" style={{ margin: '48px auto', maxWidth: 900 }}>
        <div
          className="about-dotori-card"
          style={{ borderRadius: 18, padding: '2.5rem 2rem', marginBottom: '2.5rem' }}
        >
          <h1 style={{ textAlign: 'center', color: '#6b5b47', marginBottom: '1.5rem' }}>
            {c.coreValuesHeading}
          </h1>
          <img
            src={c.coreValuesImage?.url || '/assets/images/core_values_small.png'}
            alt="Core Values"
            style={{
              display: 'block',
              margin: '0 auto 1rem',
              borderRadius: 12,
              maxWidth: '100%',
              height: 'auto',
            }}
          />
        </div>
      </section>

      {/* meet the founder section */}
      <section className="container" style={{ margin: '48px auto 48px auto', maxWidth: 900 }}>
        <div
          className="about-dotori-card"
          style={{
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            padding: '2.5rem 2rem',
            marginBottom: '2.5rem',
          }}
        >
          <h1 style={{ textAlign: 'center', color: '#6b5b47', marginBottom: '1.5rem' }}>
            {c.founderHeading}
          </h1>
          <img
            src={founder.photo?.url || founder.photoUrl || '/assets/images/yesol_profile.jpeg'}
            alt={founder.name || 'Founder'}
            className="profile-img"
            style={{
              display: 'block',
              margin: '0 auto 1rem',
              borderRadius: '50%',
              width: 120,
              height: 120,
              objectFit: 'cover',
            }}
          />

          <p
            style={{
              fontSize: '1.12rem',
              color: '#444',
              marginBottom: '1.5rem',
              textAlign: 'left',
              whiteSpace: 'pre-line',
            }}
          >
            {founder.aboutNarrative}
          </p>
          <p style={{ color: '#555', fontSize: '1.05rem', textAlign: 'left', marginBottom: '1.25rem' }}>
            {c.founderCtaBody}
          </p>
          <div style={{ textAlign: 'center' }}>
            <a
              href="/diagnostic"
              className="btn btn-primary"
              style={{ display: 'inline-block', flex: 'none', padding: '0.8rem 2rem' }}
            >
              {c.ctaText}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
