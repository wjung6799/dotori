import { getGlobal, getTeam } from '@/lib/cms';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const c = await getGlobal('teamPage');
  const team = await getTeam();

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
          {c.heading}
        </h1>
        <section className="profile-container">
          {team.map((m) => (
            <section className="profile-card" key={m.id}>
              <img
                src={m.photo?.url || m.photoUrl}
                alt={m.name}
                className="profile-img"
                style={m.imgPosition && m.imgPosition !== 'center' ? { objectPosition: m.imgPosition } : undefined}
              />
              <h2>{m.name}</h2>
              {m.honorific ? <h2>{m.honorific}</h2> : null}
              <h3>{m.role}</h3>
              <ul className="profile-details">
                {(m.details || []).map((d, i) => (
                  <li key={i}>
                    <strong>{d.label}</strong>
                    {d.value ? <>: {d.value}</> : null}
                  </li>
                ))}
              </ul>
              {m.email ? (
                <p style={{ textAlign: 'center', margin: '1rem 0 0 0' }}>
                  <a
                    href={`mailto:${m.email}`}
                    style={{ color: '#6b5b47', textDecoration: 'underline', fontSize: '0.95rem' }}
                  >
                    {m.email}
                  </a>
                </p>
              ) : null}
            </section>
          ))}
        </section>
      </main>
    </>
  );
}
