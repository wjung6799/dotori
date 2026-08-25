'use client';

import { useState } from 'react';

const BROWN = '#6b5b47';

// Fallback path when no diagnostic slots are open: the family tells us about
// their child and we reach out to schedule. The primary path is the self-serve
// slot picker in DiagnosticBooking.jsx.
export default function DiagnosticRequest({ defaultTrack = '' }) {
  const [form, setForm] = useState({
    parentName: '', email: '', phone: '', studentName: '', track: defaultTrack, message: '', website: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { emailed }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.parentName.trim() || !form.email.trim()) {
      setError('Please add your name and email.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/diagnostic/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: form.parentName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          studentName: form.studentName.trim(),
          track: form.track || undefined,
          message: form.message.trim(),
          website: form.website, // honeypot
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError(data.error || 'Could not send your request. Please try again.'); return; }
      setDone({ emailed: data.emailed !== false });
    } catch {
      setError('Something went wrong. Please try again, or email info@dotorischool.org.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={card()}>
        <div style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>🎉</div>
        <h2 style={{ color: BROWN, marginBottom: '0.75rem' }}>Request received!</h2>
        <p style={{ color: '#555', fontSize: '1.05rem' }}>
          Thanks, {form.parentName.trim().split(' ')[0] || 'there'}! We’ll reach out within one business day to
          set up {form.studentName.trim() ? `${form.studentName.trim()}’s` : 'your child’s'} free diagnostic.
        </p>
        <p style={{ color: '#555', marginTop: '0.75rem' }}>
          {done.emailed
            ? <>A confirmation is on its way to <strong>{form.email}</strong>. </>
            : <>We’ll be in touch at <strong>{form.email}</strong>. </>}
          There’s nothing to prepare, and no obligation.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={card()}>
      <h2 style={{ color: BROWN, marginBottom: '0.25rem', fontSize: '1.4rem' }}>Request your free diagnostic</h2>
      <p style={{ color: '#9b8b77', marginBottom: '1.25rem' }}>
        Tell us a little about your child and we’ll reach out to find a time that works.
      </p>

      <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Field label="Parent name">
          <input value={form.parentName} onChange={set('parentName')} style={inp()} autoComplete="name" />
        </Field>
        <Field label="Student name (optional)">
          <input value={form.studentName} onChange={set('studentName')} style={inp()} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={set('email')} style={inp()} autoComplete="email" />
        </Field>
        <Field label="Phone (optional)">
          <input value={form.phone} onChange={set('phone')} style={inp()} autoComplete="tel" />
        </Field>
        <Field label="Which track?" span2>
          <select value={form.track} onChange={set('track')} style={inp()}>
            <option value="">Not sure yet</option>
            <option value="math">Math &amp; Test Prep</option>
            <option value="language">Literacy (English &amp; Korean)</option>
            <option value="both">Both</option>
          </select>
        </Field>
        <Field label="Anything we should know? (grade, goals, preferred days/times)" span2>
          <textarea value={form.message} onChange={set('message')} rows={4} style={{ ...inp(), resize: 'vertical' }} />
        </Field>
      </div>

      {/* Honeypot: hidden from real users */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Leave this empty<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
      </div>

      {error && <p style={{ color: '#b5654a', fontWeight: 600, marginTop: '1rem' }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary"
        style={{ marginTop: '1.25rem', width: '100%', fontSize: '1.05rem', padding: '1rem', opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? 'Sending…' : 'Request my free diagnostic'}
      </button>
      <p style={{ textAlign: 'center', color: '#9b8b77', fontSize: '0.85rem', marginTop: '0.75rem' }}>
        Free · 30–45 minutes · no obligation
      </p>
    </form>
  );
}

function Field({ label, children, span2 = false }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: span2 ? '1 / -1' : 'auto', fontSize: '0.85rem', fontWeight: 600, color: '#6b5b47' }}>
      {label}
      {children}
    </label>
  );
}

const card = () => ({
  position: 'relative', background: 'rgba(255,255,255,0.95)', borderRadius: 20,
  padding: '2.25rem', boxShadow: '0 15px 30px rgba(139, 115, 85, 0.12)',
});
const inp = () => ({
  padding: '0.7rem 0.85rem', borderRadius: 10, border: '1.5px solid #e0d7c8',
  fontSize: '0.98rem', fontFamily: 'inherit', width: '100%',
});
