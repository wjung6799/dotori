import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Providers from '@/components/Providers';

export const metadata = {
  title: {
    default: 'Dotori School | Personalized Literacy & Math Tutoring in Bellevue',
    template: '%s | Dotori School',
  },
  description:
    'Dotori School offers personalized literacy & math tutoring in Bellevue, with a lesson plan built for each student. English reading & writing, Korean, math, test prep, AMC, physics, and coding. Book a free diagnostic assessment.',
  keywords: [
    'tutoring Bellevue', 'math tutoring Bellevue', 'test prep Bellevue', 'AMC prep Bellevue',
    'personalized tutoring', 'small group tutoring', 'Korean classes Bellevue', 'English reading writing Bellevue',
    'HiCap prep', 'physics tutoring', 'coding for kids Bellevue', 'Redmond tutoring',
  ],
  icons: {
    icon: '/assets/images/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes into <body> before React hydrates; ignore that mismatch. */}
      <body suppressHydrationWarning>
        <Providers>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
