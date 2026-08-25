'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

// The marketing site's header. Once a family signs in they leave this shell
// entirely for the portal at /dashboard (its own root layout, its own css), so
// this nav stays purely a marketing nav for every visitor. The only thing that
// changes when signed in is the right-hand button: it becomes the way back into
// the portal.

// Programs dropdown: every program page lives under this one nav tab.
const PROGRAM_LINKS = [
  { href: '/programs', label: 'English Literacy' },
  { href: '/math', label: 'Math & Test Prep' },
  { href: '/korean', label: 'Korean Language' },
  { href: '/private-lessons', label: 'Private/Semi-Private Lessons' },
  { href: '/summer-camp', label: 'Summer Camp' },
];

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/team', label: 'Our Team' },
  { href: '/calendar', label: 'Calendar' },
  { dropdown: true, label: 'Programs' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/contact', label: 'Contact Us', cta: true },
];

// Where the "back into the portal" button points, per role. The label names the
// destination rather than the contents ("To Dashboard", not "My Account") so it
// reads as a door back into the console.
function portalHome(role) {
  if (role === 'admin') return { href: '/admin/classes', label: 'To Admin' };
  if (role === 'tutor') return { href: '/tutor', label: 'To Dashboard' };
  return { href: '/dashboard', label: 'To Dashboard' };
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const close = () => {
    setOpen(false);
    setProgramsOpen(false);
  };

  const onProgramPage = PROGRAM_LINKS.some((l) => l.href === pathname);

  // Auth links, rendered both inside the mobile dropdown and in the right-hand
  // desktop zone (CSS shows the right one per breakpoint).
  const authLinks =
    status === 'authenticated' ? (
      (() => {
        const home = portalHome(session?.user?.role);
        return (
          <>
            <li className="auth-item">
              <Link href={home.href} className="login-btn" onClick={close}>
                {home.label}
              </Link>
            </li>
            <li className="auth-item">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                  signOut({ callbackUrl: '/' });
                }}
              >
                Sign Out
              </a>
            </li>
          </>
        );
      })()
    ) : (
      <li className="auth-item">
        <Link
          href="/login"
          className={`login-btn${pathname === '/login' ? ' active' : ''}`}
          onClick={close}
        >
          Log In
        </Link>
      </li>
    );

  return (
    <header>
      <nav className="container">
        <div className="logo">
          <Link href="/">
            <img
              src="/assets/images/logo.png"
              alt="Dotori School Logo"
              style={{ maxWidth: 80 }}
              className="logo-img"
            />
            <span
              className="logo-text"
              style={{ display: 'none', fontSize: '1.5rem', fontWeight: 700, color: '#6b5b47' }}
            >
              Dotori School
            </span>
          </Link>
        </div>

        <button
          className="nav-toggle"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '2rem',
            color: '#6b5b47',
            display: 'none',
            position: 'absolute',
            right: 24,
            top: 18,
            zIndex: 1001,
          }}
        >
          &#9776;
        </button>

        {/* Center: main links (auth links append here for the mobile dropdown) */}
        <ul className={`nav-links${open ? ' nav-open' : ''}`}>
          {NAV_LINKS.map((link) =>
            link.dropdown ? (
              <li
                key="programs"
                className={`has-dropdown${programsOpen ? ' submenu-open' : ''}`}
              >
                <button
                  type="button"
                  className={`dropdown-toggle${onProgramPage ? ' active' : ''}`}
                  aria-haspopup="true"
                  aria-expanded={programsOpen}
                  onClick={() => setProgramsOpen((v) => !v)}
                >
                  {link.label} <span aria-hidden="true">▾</span>
                </button>
                <ul className="dropdown-menu">
                  {PROGRAM_LINKS.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className={pathname === l.href ? 'active' : undefined}
                        onClick={close}
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={
                    link.cta
                      ? `login-btn${pathname === link.href ? ' active' : ''}`
                      : pathname === link.href
                        ? 'active'
                        : undefined
                  }
                  onClick={close}
                >
                  {link.label}
                </Link>
              </li>
            ),
          )}
          {authLinks}
        </ul>

        {/* Right: auth zone (desktop only) */}
        <ul className="nav-auth">{authLinks}</ul>
      </nav>
    </header>
  );
}
