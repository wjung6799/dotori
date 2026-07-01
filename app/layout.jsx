import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'Dotori School',
  description:
    'Dotori (도토리) — an in-person afterschool program in the Redmond and Bellevue area with classes of four students or fewer.',
  icons: {
    icon: '/assets/images/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
