import Link from 'next/link';
import { getPayload } from 'payload';
import config from '@payload-config';
import ProgramCard from '../programs/ProgramCard';

export const metadata = {
  title: 'Korean Classes in Bellevue | Hangeul & Korean Book Club | Dotori School',
  description:
    'Korean classes for kids in Bellevue. Hangeul phonics for beginners and an advanced Korean book club, in warm small groups with a personalized plan for each student.',
};

// Korean program cards come from the same CMS global as the Literacy page
// (programsPage, category "creative"), so staff keep editing them in one place.
export const dynamic = 'force-dynamic';

export default async function KoreanPage() {
  let data = null;
  try {
    const payload = await getPayload({ config });
    // depth:1 populates the PDF file uploads nested in program cards (ctas/curriculum).
    data = await payload.findGlobal({ slug: 'programsPage', depth: 1 });
  } catch (err) {
    console.error('Korean CMS read failed, using fallback copy:', err);
  }

  const programs = (data?.programs || []).filter((p) => p.category === 'creative');

  return (
    <main>
      <div className="container">
        <div className="page-header">
          <h1>{data?.koreanTabLabel || 'Korean'}</h1>
          <p style={{ textAlign: 'left' }}>
            Korean classes for every level, from first Hangeul letters to an advanced Korean book club.
            Small groups, warm teachers, and a personalized plan for each student. A great fit for
            families who want to keep the Korean language alive at home.
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
