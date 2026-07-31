import MathClient from './MathClient';

export const metadata = {
  title: 'Math Tutoring & Test Prep in Bellevue | AMC, Physics, Coding | Dotori School',
  description:
    'Personalized math and test prep in Bellevue. Small groups, each on their own plan. School math, AMC competition math, physics, and Python coding. Free diagnostic assessment. Daytime slots for homeschoolers.',
};

// Math & Test Prep page. Copy (EN + KO) lives in MathClient.
export default function MathPage() {
  return <MathClient />;
}
