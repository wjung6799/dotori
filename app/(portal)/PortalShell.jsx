'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

// Sidebar + mobile drawer. The links are rendered from the server-provided user,
// so there is no signed-out flash the way the marketing header has: the portal
// only ever renders for someone who is already signed in.

const FAMILY_NAV = [
  {
    section: null,
    links: [
      { href: '/dashboard', label: 'Overview', icon: '◎', exact: true },
      { href: '/dashboard/booking', label: 'Book a 1:1 session', icon: '🗓' },
      { href: '/dashboard/classes', label: 'Group classes', icon: '📚' },
    ],
  },
  {
    section: 'My family',
    links: [
      { href: '/dashboard/students', label: 'Students', icon: '🌱' },
      { href: '/dashboard/reports', label: 'Reports & feedback', icon: '📄' },
    ],
  },
  {
    section: 'Billing',
    links: [
      { href: '/dashboard/credits', label: 'Session credits', icon: '🎟' },
      { href: '/dashboard/billing', label: 'Invoices & billing', icon: '💳' },
    ],
  },
  {
    section: 'Settings',
    links: [{ href: '/dashboard/account', label: 'Account', icon: '⚙' }],
  },
];

// Staff share the portal shell so there is one console shape for the whole
// school. The legacy tabbed /admin page is still linked until its tabs move here.
const ADMIN_NAV = [
  {
    section: null,
    links: [
      { href: '/admin/classes', label: 'Class catalog', icon: '📚' },
      { href: '/admin', label: 'Families & records', icon: '🗂', exact: true },
      { href: '/admin/booking', label: 'Availability', icon: '🗓', exact: true },
    ],
  },
  {
    section: 'Money',
    links: [
      { href: '/admin/invoices', label: 'Invoices', icon: '🧾' },
      { href: '/admin/rates', label: 'Tutor rates', icon: '🏷' },
      { href: '/admin/credits', label: 'Session credits', icon: '🎟' },
    ],
  },
  {
    section: 'Review queues',
    links: [
      // countKey wires this row to a live number from /api/admin/enrollment-requests:
      // a queue nobody can see the depth of is a queue nobody clears.
      { href: '/admin/requests', label: 'Placement requests', icon: '📥', countKey: 'pending' },
      { href: '/admin/reviews', label: 'Parent reviews', icon: '⭐', exact: true },
      { href: '/admin/surveys', label: 'Enrollment forms', icon: '📝', exact: true },
      { href: '/admin/waitlist', label: 'Waitlist', icon: '⏳', exact: true },
    ],
  },
];

// Instructors get the same console shape as everyone else. Their pages used to
// live on the marketing site behind a tab bar, which meant the one role that
// works in the system every day was the one without a dashboard.
const TUTOR_NAV = [
  {
    section: null,
    links: [
      { href: '/tutor', label: 'Overview', icon: '◎', exact: true },
      { href: '/tutor/availability', label: 'My availability', icon: '🗓' },
      { href: '/tutor/bookings', label: 'My bookings', icon: '📋' },
    ],
  },
  {
    section: 'Students',
    links: [
      { href: '/tutor/feedback', label: 'Feedback', icon: '💬' },
      { href: '/tutor/placement', label: 'Class placement', icon: '📥' },
    ],
  },
  {
    section: 'Money',
    links: [
      { href: '/tutor/credits', label: 'Session tokens', icon: '🎟' },
      { href: '/tutor/rates', label: 'My rates', icon: '🏷' },
    ],
  },
];

function navFor(role) {
  if (role === 'admin') return ADMIN_NAV;
  if (role === 'tutor') return TUTOR_NAV;
  return FAMILY_NAV;
}

// Pages that still live on the marketing site. Called out separately so it is
// obvious you are leaving the portal — the portal is its own shell, so without
// this there is no way back to the public pages except the browser's Back.
const OFFSITE = [
  { href: '/', label: 'Back to the website', lead: true },
  { href: '/calendar', label: 'Academic calendar' },
  { href: '/store', label: 'Store' },
  { href: '/contact', label: 'Contact the school' },
];

function titleFor(pathname, nav) {
  for (const group of nav) {
    for (const l of group.links) {
      if (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + '/')) {
        return l.label;
      }
    }
  }
  return 'Dotori Portal';
}

export default function PortalShell({ user, children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = navFor(user?.role);
  const isAdmin = user?.role === 'admin';
  const [pendingRequests, setPendingRequests] = useState(0);

  // Admin only, and once per shell mount: enough to notice a queue has filled up
  // without putting a request on every navigation.
  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    fetch('/api/admin/enrollment-requests?status=pending')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setPendingRequests(d.pendingCount || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Close the drawer on navigation, so a tap on a link doesn't leave the scrim up.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (l) =>
    l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + '/');

  const firstName = user?.name ? user.name.split(' ')[0] : '';

  return (
    <div className={`portal${open ? ' drawer-open' : ''}`}>
      <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />

      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/assets/images/logo.png" alt="" />
          <div>
            <div className="name">Dotori School</div>
            <div className="sub">
              {isAdmin ? 'Staff console' : user?.role === 'tutor' ? 'Instructor console' : 'Family portal'}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav.map((group, gi) => (
            <div key={group.section || `g${gi}`}>
              {group.section ? <div className="sidebar-section">{group.section}</div> : null}
              {group.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`sidebar-link${isActive(l) ? ' active' : ''}`}
                  aria-current={isActive(l) ? 'page' : undefined}
                >
                  <span className="ico" aria-hidden="true">{l.icon}</span>
                  {l.label}
                  {l.countKey === 'pending' && pendingRequests > 0 ? (
                    <span className="badge">{pendingRequests}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          ))}

          <div className="sidebar-section">Main website</div>
          {OFFSITE.map((l) => (
            <Link key={l.href} href={l.href} className="sidebar-link">
              <span className="ico" aria-hidden="true">{l.lead ? '←' : '↗'}</span>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          {user?.email ? (
            <div style={{ padding: '0.25rem 0.65rem 0.5rem', minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', overflowWrap: 'anywhere' }}>
                {firstName || user.email}
              </div>
              <div style={{ color: 'rgba(243,236,226,0.55)', fontSize: '0.75rem', overflowWrap: 'anywhere' }}>
                {user.email}
              </div>
            </div>
          ) : null}
          <button type="button" onClick={() => signOut({ callbackUrl: '/' })}>
            <span className="ico" aria-hidden="true">⏻</span>
            Sign out
          </button>
        </div>
      </aside>

      <div className="portal-main">
        <div className="portal-topbar">
          <button
            type="button"
            className="burger"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            &#9776;
          </button>
          <span className="title">{titleFor(pathname, nav)}</span>
        </div>

        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}
