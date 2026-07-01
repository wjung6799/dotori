import Link from 'next/link';
import Script from 'next/script';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section
        className="hero"
        style={{
          background: 'linear-gradient(135deg, #f8f6f3 0%, #efe7dd 100%)',
          padding: '80px 0 40px',
          color: '#6b5b47',
          textAlign: 'center',
          marginTop: 56,
        }}
      >
        <div className="container">
          <h1 style={{ fontSize: '2.8rem', fontWeight: 700, marginBottom: '1.2rem' }}>
            Welcome to Dotori School
          </h1>
          <img
            src="/assets/images/hero-image.png"
            alt="Dotori School"
            style={{ maxWidth: '70%', height: 'auto', borderRadius: 10, marginBottom: '1.5rem' }}
          />
          <p style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>
            <strong>Small seeds. Big growth. Endless connections.</strong>
          </p>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
            <em>Where every student is seen, supported, and encouraged to thrive together.</em>
          </p>
          <Link
            href="/programs"
            className="btn btn-primary"
            style={{
              padding: '0.8rem 2rem',
              fontSize: '1.1rem',
              borderRadius: 30,
              background: '#6b5b47',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            Explore Programs
          </Link>
        </div>
      </section>

      {/* School Introduction */}
      <section className="container" style={{ maxWidth: 900, margin: '48px auto' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            padding: '2.5rem 2rem',
          }}
        >
          <h2 style={{ color: '#6b5b47', marginBottom: '1rem', textAlign: 'center' }}>About Dotori</h2>
          <p style={{ fontSize: '1.15rem', color: '#444', marginBottom: '1.5rem', textAlign: 'left' }}>
            Dotori (도토리)—Korean for “acorn”—is an in-person afterschool program located in the Redmond
            and Bellevue area.
            <br />
            <br />
            With classes of four students or fewer, we provide personalized guidance and close teacher
            support that help every child grow with confidence.
            <br />
            <br />
            Our program focuses on building strong foundations in English reading and writing, ensuring
            students develop the skills they need for long-term academic success. We also offer Korean
            language classes for families interested in meaningful cultural and heritage learning
            opportunities.
            <br />
            <br />
            Dotori is a great fit for families seeking small-group instruction, after-school enrichment,
            and a nurturing community that prioritizes each child’s individual growth and potential.
          </p>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link
              href="/about"
              className="btn btn-secondary"
              style={{
                padding: '0.6rem 1.5rem',
                borderRadius: 24,
                background: '#f7f5f2',
                color: '#6b5b47',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Instagram Feed */}
      <section className="container" style={{ maxWidth: 900, margin: '48px auto', textAlign: 'center' }}>
        <h2 style={{ color: '#6b5b47', marginBottom: '1rem', textAlign: 'center' }}>
          Follow Us on Instagram
        </h2>
        <blockquote
          className="instagram-media"
          data-instgrm-permalink="https://www.instagram.com/dotori.school_yesol/?utm_source=ig_embed&utm_campaign=loading"
          data-instgrm-version="14"
          style={{
            background: '#FFF',
            border: 0,
            borderRadius: 3,
            boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
            margin: '1px auto',
            maxWidth: 540,
            minWidth: 326,
            padding: 0,
            width: 'calc(100% - 2px)',
          }}
        >
          <div style={{ padding: 16 }}>
            <a
              href="https://www.instagram.com/dotori.school_yesol/?utm_source=ig_embed&utm_campaign=loading"
              style={{ background: '#FFFFFF', lineHeight: 0, padding: 0, textAlign: 'center', textDecoration: 'none', width: '100%' }}
              target="_blank"
              rel="noreferrer"
            >
              View this profile on Instagram
            </a>
          </div>
          <p style={{ color: '#c9c8cd', fontFamily: 'Arial,sans-serif', fontSize: 14, lineHeight: '17px', marginBottom: 0, marginTop: 8, overflow: 'hidden', padding: '8px 0 7px', textAlign: 'center', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <a
              href="https://www.instagram.com/dotori.school_yesol/?utm_source=ig_embed&utm_campaign=loading"
              style={{ color: '#c9c8cd', fontFamily: 'Arial,sans-serif', fontSize: 14, fontWeight: 'normal', lineHeight: '17px' }}
              target="_blank"
              rel="noreferrer"
            >
              Yesol Jung | Dotori School
            </a>{' '}
            (@
            <a
              href="https://www.instagram.com/dotori.school_yesol/?utm_source=ig_embed&utm_campaign=loading"
              style={{ color: '#c9c8cd', fontFamily: 'Arial,sans-serif', fontSize: 14, fontWeight: 'normal', lineHeight: '17px' }}
              target="_blank"
              rel="noreferrer"
            >
              dotori.school_yesol
            </a>
            ) • Instagram photos and videos
          </p>
        </blockquote>
        <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />
      </section>

      {/* Call to Action */}
      <section className="container" style={{ maxWidth: 900, margin: '48px auto' }}>
        <div style={{ background: '#6b5b47', color: '#fff', borderRadius: 18, padding: '2.5rem 2rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>Ready to Get Started?</h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
            Contact us to schedule a visit or enroll your child in Dotori School!
          </p>
          <Link
            href="/contact"
            className="btn btn-primary"
            style={{
              padding: '0.8rem 2rem',
              fontSize: '1.1rem',
              borderRadius: 30,
              background: '#fff',
              color: '#6b5b47',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Contact Us
          </Link>
        </div>
      </section>
    </>
  );
}
