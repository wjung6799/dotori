'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

// A quiet strip at the top of the hero pointing signed-in visitors back to their
// own pages. The landing page itself is never redirected away — parents still
// share and revisit program pages, and '/' stays the SEO entry point.
export default function HomeMemberBanner() {
  const { data: session, status } = useSession();
  if (status !== 'authenticated') return null;

  const role = session?.user?.role;
  const { href, label } =
    role === 'admin'
      ? { href: '/admin', label: 'Go to admin' }
      : role === 'tutor'
        ? { href: '/tutor', label: 'Go to instructor dashboard' }
        : { href: '/dashboard', label: 'Go to my dashboard' };

  const firstName = (session?.user?.name || '').split(' ')[0];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(139,115,85,0.2)',
        borderRadius: 999,
        padding: '0.5rem 0.6rem 0.5rem 1.1rem',
        marginBottom: '1.75rem',
        fontSize: '0.92rem',
        color: '#6b5b47',
      }}
    >
      <span>Welcome back{firstName ? `, ${firstName}` : ''}.</span>
      <Link
        href={href}
        style={{
          background: 'linear-gradient(135deg, #8b7355, #a0856b)',
          color: '#fff',
          fontWeight: 700,
          borderRadius: 999,
          padding: '0.4rem 1.1rem',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {label} →
      </Link>
    </div>
  );
}
