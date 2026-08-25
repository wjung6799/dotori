import './portal.css';
import { auth } from '@/auth';
import Providers from '@/components/Providers';
import PortalShell from './PortalShell';

// Root layout for the family portal. This is a SEPARATE root layout from
// app/(site)/layout.jsx — its own <html>/<body> and its own stylesheet — so the
// portal shares no chrome and no css with the marketing site. That separation is
// deliberate: the site sells, the portal operates.
export const metadata = {
  title: {
    default: 'Dotori Portal',
    template: '%s | Dotori Portal',
  },
  description: 'Dotori School family portal.',
  icons: { icon: '/assets/images/logo.png' },
  // Nothing behind the login belongs in an index.
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }) {
  const session = await auth();

  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions inject attributes into
          <body> before React hydrates; ignore that mismatch. */}
      <body suppressHydrationWarning>
        <Providers>
          <PortalShell user={session?.user ?? null}>{children}</PortalShell>
        </Providers>
      </body>
    </html>
  );
}
