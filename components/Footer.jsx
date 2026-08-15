import Link from 'next/link';

// Public number (also shown on the Contact page). Appears site-wide.
const PHONE = '(425) 405-0822';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: '#f7f5f2', padding: '2.5rem 0 2rem', color: '#888' }}>
      <div className="container" style={{ textAlign: 'center' }}>
        {/* Secondary links (demoted from the primary nav) */}
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
          {[
            ['/programs', 'English Literacy'],
            ['/math', 'Math & Test Prep'],
            ['/korean', 'Korean Language'],
            ['/private-lessons', 'Private/Semi-Private Lessons'],
            ['/summer-camp', 'Summer Camp'],
            ['/reviews', 'Reviews'],
            ['/team', 'Our Team'],
            ['/calendar', 'Calendar'],
            ['/contact', 'Contact'],
            ['/store', 'Store'],
          ].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#6b5b47', textDecoration: 'none', fontSize: '0.92rem', fontWeight: 500 }}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Contact block */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0.3rem 0', color: '#6b5b47', fontWeight: 600 }}>
            12721 NE Bel-Red Rd. #220 (2nd Floor), Bellevue, WA 98005
          </p>
          <p style={{ margin: '0.3rem 0' }}>
            <a href="mailto:info@dotorischool.org" style={{ color: '#6b5b47', fontWeight: 600, textDecoration: 'none' }}>
              info@dotorischool.org
            </a>
            {PHONE ? (
              <>
                {' · '}
                <a href={`tel:${PHONE.replace(/[^\d+]/g, '')}`} style={{ color: '#6b5b47', fontWeight: 600, textDecoration: 'none' }}>
                  {PHONE}
                </a>
              </>
            ) : null}
          </p>
        </div>

        <p style={{ margin: 0, fontSize: '0.85rem' }}>&copy; {year} Dotori School. All rights reserved.</p>
      </div>
    </footer>
  );
}
