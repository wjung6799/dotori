import { getPayload } from 'payload';
import config from '@payload-config';
import ProgramCard from '../programs/ProgramCard';

export const metadata = {
  title: 'Summer Camp in Bellevue | Dotori School',
  description:
    'Dotori School summer camp in Bellevue. Two-week sessions by grade level, in the same warm small groups we teach all year. See session dates and camp details.',
};

// Summer camp cards come from the same CMS global as the Literacy page
// (programsPage, category "summer"), so staff keep editing them in one place.
export const dynamic = 'force-dynamic';

export default async function SummerCampPage() {
  let data = null;
  try {
    const payload = await getPayload({ config });
    // depth:1 populates the PDF file uploads nested in program cards (ctas/curriculum).
    data = await payload.findGlobal({ slug: 'programsPage', depth: 1 });
  } catch (err) {
    console.error('Summer camp CMS read failed, using fallback copy:', err);
  }

  const programs = (data?.programs || []).filter((p) => p.category === 'summer');

  return (
    <main>
      <div className="container">
        <div className="page-header">
          <h1>Summer Camp</h1>
          <p style={{ textAlign: 'left' }}>
            Two-week summer sessions by grade level, in the same warm small groups we
            teach all year. Session dates and full camp details are below.
          </p>
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
