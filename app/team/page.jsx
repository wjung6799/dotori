export default function TeamPage() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
    /* Responsive team grid layout */
    .profile-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: stretch;
        gap: 2rem;
    }

    .profile-card {
        max-width: 480px;
        width: 100%;
        flex: 1 1 380px;
    }

    /* Profile image styling */
    .profile-img {
        width: 200px;
        height: 200px;
        border-radius: 50%;
        object-fit: cover;
        object-position: center;
        margin: 0 auto 1rem auto;
        display: block;
    }
    @media (max-width: 768px) {
        .profile-container {
            grid-template-columns: 1fr;
            gap: 2rem;
        }
    }
`,
        }}
      />

      <main className="container" style={{ maxWidth: 1200, margin: '48px auto' }}>
        <h1 style={{ textAlign: 'center', color: '#6b5b47', marginBottom: '2rem' }}>
          Meet Our Team
        </h1>
        <section className="profile-container">
          <section className="profile-card">
            <img
              src="/assets/images/yesol_profile.jpeg"
              alt="Teacher Yesol"
              className="profile-img"
            />
            <h2>Yesol Jung</h2>
            <h2>(Mrs. Jung)</h2>
            <h3>Founder &amp; Teacher</h3>
            <ul className="profile-details">
              <li>
                <strong>Education:</strong> B.A. in English, University of Washington; M.Ed.,
                Seattle University
              </li>
              <li>
                <strong>Certifications:</strong> Washington State Teaching Certificates in
                Elementary Education, ELL, and Korean Language
              </li>
              <li>
                <strong>Experience:</strong> 10+ years in public education, teaching in 20+ schools
                across Washington State
              </li>
              <li>
                <strong>National Board Certified Teacher</strong>
              </li>
              <li>
                <strong>Specialty:</strong> Writing, Reading Comprehension, Korean Language Learning
              </li>
            </ul>
            <p style={{ textAlign: 'center', margin: '1rem 0 0 0' }}>
              <a
                href="mailto:yesoljung@dotorischool.org"
                style={{ color: '#6b5b47', textDecoration: 'underline', fontSize: '0.95rem' }}
              >
                yesoljung@dotorischool.org
              </a>
            </p>
          </section>
          <section className="profile-card">
            <img
              src="/assets/images/teacher2_profile.jpeg"
              alt="Teacher Won Jung"
              className="profile-img"
              style={{ objectPosition: 'center 18%' }}
            />
            <h2>Won Jung</h2>
            <h2>(Mr. Jung)</h2>
            <h3>STEM Teacher</h3>
            <ul className="profile-details">
              <li>
                <strong>Education:</strong> B.S. in Physics, University of Washington (Math minor)
              </li>
              <li>
                <strong>Experience:</strong> Software Engineer at Meta, Microsoft, and Boeing; 15+
                years tutoring
              </li>
              <li>
                <strong>100% student placement at top-30 universities</strong>
              </li>
              <li>
                <strong>Specialty:</strong> Math, Physics, Computer Science
              </li>
            </ul>
            <p style={{ textAlign: 'center', margin: '1rem 0 0 0' }}>
              <a
                href="mailto:wonjung@dotorischool.org"
                style={{ color: '#6b5b47', textDecoration: 'underline', fontSize: '0.95rem' }}
              >
                wonjung@dotorischool.org
              </a>
            </p>
          </section>
          {/* Add more team members here as needed */}
        </section>
      </main>
    </>
  );
}
