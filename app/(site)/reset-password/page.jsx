'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// The landing page for the emailed reset link: ?token=… plus a new password.
// The token is validated server-side only — this page just carries it through.
function ResetInner() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    let res;
    let d = {};
    try {
      res = await fetch('/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      d = await res.json().catch(() => ({}));
    } catch {
      // A dropped connection must not leave the button stuck on the one page
      // where the user cannot log in to get help.
      setError('Something went wrong. Check your connection and try again.');
      return;
    } finally {
      setSubmitting(false);
    }
    if (!res.ok) {
      setError(d.error || 'Could not reset the password. Please try again.');
      return;
    }
    setDone(true);
  }

  return (
    <main className="container" style={{ maxWidth: 440, margin: '40px auto' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          padding: '2.5rem 2rem',
        }}
      >
        <h1 style={{ color: '#6b5b47', marginBottom: '0.5rem', textAlign: 'center' }}>
          Choose a new password
        </h1>

        {done ? (
          <>
            <div
              style={{
                background: '#eef7ea',
                color: '#3d6b45',
                padding: '0.9rem 1rem',
                borderRadius: 10,
                fontSize: '0.92rem',
                marginTop: '1.25rem',
              }}
            >
              Your password is updated. You can log in with it now.
            </div>
            <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <Link href="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
                Log in
              </Link>
            </p>
          </>
        ) : !token ? (
          <p style={{ color: '#888', textAlign: 'center', marginTop: '1.25rem' }}>
            This page only works from the link in a reset email.{' '}
            <Link href="/forgot-password" style={{ color: '#6b5b47', fontWeight: 600 }}>
              Request one here
            </Link>
            .
          </p>
        ) : (
          <>
            <p style={{ color: '#888', textAlign: 'center', marginBottom: '1.75rem' }}>
              At least 8 characters.
            </p>
            {error && (
              <div
                style={{
                  background: '#fdecea',
                  color: '#b3261e',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  marginBottom: '1rem',
                  fontSize: '0.9rem',
                }}
              >
                {error}{' '}
                {/expired/i.test(error) ? (
                  <Link href="/forgot-password" style={{ color: '#6b5b47', fontWeight: 600 }}>
                    Request a new link
                  </Link>
                ) : null}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <label htmlFor="password" style={{ display: 'block', color: '#6b5b47', fontWeight: 600, marginBottom: 6 }}>
                New password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                style={inputStyle}
              />
              <label htmlFor="confirm" style={{ display: 'block', color: '#6b5b47', fontWeight: 600, margin: '1rem 0 6px' }}>
                Type it again
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1.5rem', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 12,
  border: '1px solid #ddd',
  fontSize: '1rem',
  fontFamily: 'inherit',
};
