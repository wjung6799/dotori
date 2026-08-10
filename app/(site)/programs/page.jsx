import LiteracyClient from './LiteracyClient';

export const metadata = {
  title: 'English Literacy Program in Bellevue | Dotori School',
  description:
    'Every student starts with a placement assessment and is placed by demonstrated literacy into four levels: Acorn, Sprout, Sapling, and Oak. Phonics, Core Literacy, Book Club, and a publishing Writer’s Workshop, in small groups in Bellevue.',
};

// The English Literacy program: diagnostic-based placement, four leveled
// courses, and the weekly schedule. Copy (EN + KO) lives in LiteracyClient.
export default function ProgramsPage() {
  return <LiteracyClient />;
}
