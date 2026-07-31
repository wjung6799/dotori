import Link from 'next/link';
import { getPayload } from 'payload';
import config from '@payload-config';
import ProgramCard from '../programs/ProgramCard';

export const metadata = {
  title: 'Private & Semi-Private Lessons in Bellevue | Dotori School',
  description:
    'One-on-one and semi-private lessons at Dotori School in Bellevue. Flexible scheduling with the instructor and a lesson plan built around your child, in any academic area.',
};

// Private-lesson cards come from the same CMS global as the Literacy page
// (programsPage, category "tutor"), so staff keep editing them in one place.
export const dynamic = 'force-dynamic';

export default async function PrivateLessonsPage() {
  let data = null;
  try {
    const payload = await getPayload({ config });
    // depth:1 populates the PDF file uploads nested in program cards (ctas/curriculum).
    data = await payload.findGlobal({ slug: 'programsPage', depth: 1 });
  } catch (err) {
    console.error('Private lessons CMS read failed, using fallback copy:', err);
  }

  const programs = (data?.programs || []).filter((p) => p.category === 'tutor');

  return (
    <main>
      <div className="container">
        <div className="page-header">
          <h1>Private &amp; Semi-Private Lessons</h1>
          <p style={{ textAlign: 'left' }}>
            One-on-one and semi-private lessons, scheduled directly with the instructor.
            Any academic area, from reading and writing to math and test prep, with a
            lesson plan built around your child.
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <Link href="/diagnostic" className="btn btn-primary" style={{ padding: '0.9rem 2.25rem', fontSize: '1.05rem', flex: 'none', display: 'inline-block' }}>
              Book a Free Diagnostic Assessment
            </Link>
          </div>
        </div>

        <div className="programs-grid">
          {programs.map((p, idx) => (
            <ProgramCard key={idx} p={p} />
          ))}
        </div>
      </div>
    </main>
  );
}
