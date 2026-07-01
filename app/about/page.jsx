export default function AboutPage() {
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
            Dotori School is ideal for
          </h1>
          <div style={{ fontSize: '1.15rem', color: '#444', textAlign: 'left' }}>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem', lineHeight: 1.8 }}>
              <li>Students who require a solid foundation in English reading and writing skills</li>
              <li>Students who benefit from small-group instruction (maximum 4 students per class)</li>
              <li>Students who are new to English and benefit from structured language development</li>
              <li>English–Korean bilingual learners seeking strong literacy support</li>
              <li>Students who want to learn Korean in an engaging and enjoyable way</li>
              <li>Students building academic confidence in communication and classroom participation</li>
              <li>Families looking for high-quality, in-person afterschool enrichment in the Redmond/Bellevue area</li>
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
            Our Core Values
          </h1>
          <img
            src="/assets/images/core_values_small.png"
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
            Meet the Founder
          </h1>
          <img
            src="/assets/images/yesol_profile.jpeg"
            alt="Teacher Yesol"
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
            }}
          >
            Hello, I’m Yesol Jung—an educator, curriculum designer, and the heart behind Dotori
            School.
            <br />
            For over a decade, I’ve taught in diverse schools across Washington State, working with
            students from different backgrounds, languages, and cultures. My passion for language
            learning, literacy development, and cultural connection inspired me to create a space
            where these values come together.
            <br />
            <br />
            I chose the name Dotori—meaning “acorn” in Korean—because I believe every learner holds
            the potential to grow into something extraordinary, given the right care, guidance, and
            environment.
          </p>
          <p style={{ color: '#555', fontSize: '1.05rem', textAlign: 'left' }}>
            Discover how Dotori can help your child thrive in reading and writing. Contact us to
            learn more about our programs, schedule a visit, or enroll today!
          </p>
        </div>
      </section>
    </>
  );
}
