'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSubmitting(false);
        setError(data.error || 'Could not create account.');
        return;
      }

      // Account created; sign them in immediately.
      const signInRes = await signIn('credentials', { email, password, redirect: false });
      setSubmitting(false);
      if (signInRes?.error) {
        setError('Account created, but automatic login failed. Please log in.');
        router.push('/login');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setSubmitting(false);
      setError('Network error. Please try again.');
    }
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
        <h1 style={{ color: '#6b5b47', marginBottom: '0.5rem', textAlign: 'center' }}>Create Account</h1>
        <p style={{ color: '#888', textAlign: 'center', marginBottom: '1.75rem' }}>
          Join Dotori School
        </p>

        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '0.8rem 1rem',
            borderRadius: 12,
            border: '1px solid #ddd',
            background: '#fff',
            color: '#444',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '1.5rem 0' }}>
          <span style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ color: '#aaa', fontSize: '0.85rem' }}>or</span>
          <span style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

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
          <label htmlFor="name" style={{ display: 'block', color: '#6b5b47', fontWeight: 600, marginBottom: 6 }}>
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            style={inputStyle}
          />

          <label htmlFor="email" style={{ display: 'block', color: '#6b5b47', fontWeight: 600, margin: '1rem 0 6px' }}>
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

          <label
            htmlFor="password"
            style={{ display: 'block', color: '#6b5b47', fontWeight: 600, margin: '1rem 0 6px' }}
          >
            Password
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
          <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: 6 }}>At least 8 characters.</p>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.25rem', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#888' }}>
          Already have an account?{' '}
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
