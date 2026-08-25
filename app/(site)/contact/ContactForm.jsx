'use client';

import { useState } from 'react';
import Link from 'next/link';

// Contact form: student name/grade, parent name, email, phone, and a short
// note. Submissions email the school via /api/contact.

const BROWN = '#6b5b47';

const lbl = () => ({ display: 'block', fontWeight: 600, color: BROWN, fontSize: '0.92rem', marginBottom: '0.35rem' });
const inp = () => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.65rem 0.8rem',
  border: '1.5px solid #ddd',
  borderRadius: 8,
  fontSize: '0.92rem',
  marginBottom: '1rem',
  background: '#fff',
  fontFamily: 'inherit',
});

export default function ContactForm({ heading }) {
  const [form, setForm] = useState({
    studentName: '',
    grade: '',
    parentName: '',
    email: '',
    phone: '',
    note: '',
    website: '', // honeypot
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(d.error || 'Something went wrong. Please try again.');
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main>
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="page-header">
          <h1>{heading}</h1>
        </div>

        {/* New literacy students book their placement test directly. */}
        <Link
          href="/diagnostic"
          style={{
            display: 'block',
            background: '#fbf6e9',
            border: '1px solid #ecd9a8',
            borderRadius: 12,
            padding: '1rem 1.4rem',
            marginBottom: '1.5rem',
            color: '#4a3c28',
            fontWeight: 700,
            textDecoration: 'none',
            textAlign: 'center',
          }}
        >
          🌰 New literacy student? Book a Placement Test →
        </Link>

        {done ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '2.5rem', textAlign: 'center', boxShadow: '0 8px 20px rgba(139,115,85,0.08)', marginBottom: '3rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌰</div>
            <h2 style={{ color: '#4a3c28', fontSize: '1.3rem', marginBottom: '0.5rem' }}>Thank you!</h2>
            <p style={{ color: BROWN, margin: 0 }}>
              Your message has been sent. We&rsquo;ll be in touch soon.
            </p>
          </div>
        ) : (
          <form
            onSubmit={submit}
            style={{ background: '#fff', borderRadius: 14, padding: '1.75rem', boxShadow: '0 8px 20px rgba(139,115,85,0.08)', marginBottom: '3rem' }}
          >
            {/* Honeypot: humans never see or fill this. */}
            <div style={{ position: 'absolute', left: -9999, opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
              <label htmlFor="ct-website">Website</label>
              <input id="ct-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
            </div>

            <label style={lbl()}>Student Name *</label>
            <input style={inp()} value={form.studentName} onChange={(e) => set('studentName', e.target.value)} required />

            <label style={lbl()}>Student Grade *</label>
            <input style={inp()} value={form.grade} onChange={(e) => set('grade', e.target.value)} required />

            <label style={lbl()}>Parent/Guardian Name *</label>
            <input style={inp()} value={form.parentName} onChange={(e) => set('parentName', e.target.value)} required />

            <label style={lbl()}>Email Address *</label>
            <input type="email" style={inp()} value={form.email} onChange={(e) => set('email', e.target.value)} required />

            <label style={lbl()}>Phone Number *</label>
            <input type="tel" style={inp()} value={form.phone} onChange={(e) => set('phone', e.target.value)} required />

            <label style={lbl()}>Note</label>
            <textarea
              rows={4}
              style={inp()}
              placeholder="Anything you would like us to know"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />

            {msg ? <p style={{ color: '#a3261a', fontWeight: 600 }}>{msg}</p> : null}

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 'none', padding: '0.8rem 2.25rem' }}>
              {saving ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
