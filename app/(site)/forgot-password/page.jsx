'use client';

import { useState } from 'react';
import Link from 'next/link';

// Ask for the account email and request a reset link. The confirmation reads
// the same whether the account exists or not — the page must not be a way to
// probe which emails have accounts.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    let res;
    let d = {};
    try {
      res = await fetch('/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
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
      setError(d.error || 'Something went wrong. Please try again.');
      return;
    }
    setSent(true);
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
          Reset your password
        </h1>
        <p style={{ color: '#888', textAlign: 'center', marginBottom: '1.75rem' }}>
          Tell us your account email and we&rsquo;ll send a reset link.
        </p>

        {sent ? (
          <div
            style={{
              background: '#eef7ea',
              color: '#3d6b45',
              padding: '0.9rem 1rem',
              borderRadius: 10,
              fontSize: '0.92rem',
            }}
          >
            If an account exists for <strong>{email}</strong>, a reset link is on its way. It works
            once and expires in an hour — check your spam folder if it doesn&rsquo;t arrive.
          </div>
        ) : (
          <>
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
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <label htmlFor="email" style={{ display: 'block', color: '#6b5b47', fontWeight: 600, marginBottom: 6 }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1.5rem', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Sending…' : 'Email me a reset link'}
              </button>
            </form>
          </>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#888' }}>
          Remembered it?{' '}
          <Link href="/login" style={{ color: '#6b5b47', fontWeight: 600 }}>
            Log in
          </Link>
        </p>
      </div>
    </main>
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
