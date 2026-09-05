'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

// Parent contact details + sign-out. This is the account half of the old
// /profile page; the student editor moved to /dashboard/students so both pages
// are not fighting over the same array.
export default function AccountPage() {
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  // PUT /api/family/profile replaces the students array with whatever it is
  // given, so we hold the loaded list verbatim and send it straight back.
  // Dropping it here would wipe every student on the account.
  const [students, setStudents] = useState([]);

  const [saving, setSaving] = useState(false);
  // The load failed, so `students` (and every other field) is empty rather than
  // real. Saving in that state would send students: [] and the PUT would delete
  // the whole array, so the form stays locked until a load succeeds.
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/family/profile');
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Could not load your account.');
        const u = data.user || {};
        setEmail(u.email || '');
        setFirstName(u.firstName || '');
        setLastName(u.lastName || '');
        setPhone(u.phone || '');
        setStudents(Array.isArray(u.students) ? u.students : []);
      } catch (err) {
        if (cancelled) return;
        setFailed(true);
        setMsg({ type: 'err', text: err.message || 'Could not load your account.' });
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!loaded || failed) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/family/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          // Untouched — see the note on the students state above.
          students: students.map((s) => ({ name: s.name, grade: s.grade })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your changes.');
      const u = data.user || {};
      setFirstName(u.firstName || '');
      setLastName(u.lastName || '');
      setPhone(u.phone || '');
      if (Array.isArray(u.students)) setStudents(u.students);
      setMsg({ type: 'ok', text: 'Changes saved' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Could not save your changes.' });
    } finally {
      setSaving(false);
    }
  }

  const studentCount = students.filter((s) => s && s.name).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p className="lede">Your contact details, so we know who to reach about a session.</p>
        </div>
      </div>

      {msg ? <div className={`notice ${msg.type}`}>{msg.text}</div> : null}

      <div className="card">
        <div className="card-head">
          <h2>Contact details</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="acct-first">First name</label>
              <input
                id="acct-first"
                type="text"
                autoComplete="given-name"
                value={firstName}
                disabled={!loaded || failed}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="acct-last">Last name</label>
              <input
                id="acct-last"
                type="text"
                autoComplete="family-name"
                value={lastName}
                disabled={!loaded || failed}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="acct-phone">Phone</label>
            <input
              id="acct-phone"
              type="tel"
              autoComplete="tel"
              placeholder="(000) 000-0000"
              value={phone}
              disabled={!loaded || failed}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="hint">We text here if a tutor runs late or a class is cancelled.</div>
          </div>

          <div className="field">
            <label htmlFor="acct-email">Email</label>
            <input id="acct-email" className="input" type="email" value={email} disabled readOnly />
            <div className="hint">
              This is the email you sign in with, so it can&rsquo;t be changed here. Contact the
              school and we&rsquo;ll move your account to a new address.
            </div>
          </div>

          <button type="submit" className="btn btn-accent" disabled={!loaded || failed || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Students</h2>
          <Link className="link" href="/dashboard/students">
            Manage students →
          </Link>
        </div>
        <p className="muted small mb0">
          {failed
            ? 'We could not load your students just now. Reload the page to try again.'
            : !loaded
              ? 'Loading…'
              : studentCount === 0
                ? 'No students added yet. Add one so we can match sessions and reports to the right child.'
                : `${studentCount} student${studentCount === 1 ? '' : 's'} on this account. Names and grades are edited on the Students page.`}
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Sign out</h2>
        </div>
        <p className="muted small">
          You&rsquo;ll need to sign in again to book sessions or see reports.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })}>
            Sign out
          </button>
          <Link className="small" href="/">
            Back to the Dotori website
          </Link>
        </div>
      </div>
    </>
  );
}
