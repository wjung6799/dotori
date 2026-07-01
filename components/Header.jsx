'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/team', label: 'Our Team' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/programs', label: 'Programs' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/contact', label: 'Contact' },
  { href: '/store', label: 'Store' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const close = () => setOpen(false);

  // Auth links — rendered both inside the mobile dropdown and in the
  // right-hand desktop zone (CSS shows the right one per breakpoint).
  const authLinks =
    status === 'authenticated' ? (
      <>
        <li className="auth-item">
          <Link
            href={role === 'admin' ? '/admin' : role === 'tutor' ? '/tutor' : '/profile'}
            className={
              pathname === '/profile' || pathname === '/admin' || pathname === '/tutor'
                ? 'active'
                : undefined
            }
            onClick={close}
          >
            {role === 'admin' ? 'Admin' : role === 'tutor' ? 'Tutor' : 'My Account'}
          </Link>
        </li>
        <li className="auth-item">
          <a
            href="#"
            className="login-btn"
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
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={pathname === link.href ? 'active' : undefined}
                onClick={close}
              >
                {link.label}
              </Link>
            </li>
          ))}
          {authLinks}
        </ul>

        {/* Right: auth zone (desktop only) */}
        <ul className="nav-auth">{authLinks}</ul>
      </nav>
    </header>
  );
}
