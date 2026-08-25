'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import DiagnosticRequest from './DiagnosticRequest';

// The single first-contact booking flow. Lists Mrs. Jung's open diagnostic-kind
// slots and books them through /api/booking/diagnostic, which creates a shell
// family account from the contact details — no login needed. When nothing is
// open we fall back to the request form so the page never dead-ends.
//
// This replaced the separate /placement-test page: literacy placement and the
// free math/literacy diagnostic are the same 45-minute visit, so they share one
// URL and one form, with the track picker deciding the wording on the emails.

const BROWN = '#6b5b47';
const DARK = '#4a3c28';

const card = () => ({
  background: '#fff',
  borderRadius: 14,
  padding: '1.75rem',
  boxShadow: '0 8px 20px rgba(139,115,85,0.08)',
  marginBottom: '1.5rem',
});
const lbl = () => ({
  display: 'block',
  fontWeight: 600,
  color: BROWN,
  fontSize: '0.92rem',
  marginBottom: '0.35rem',
});
const inp = () => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.65rem 0.8rem',
  border: '1.5px solid #ddd',
  borderRadius: 8,
  fontSize: '0.92rem',
  marginBottom: '1rem',
  background: '#fff',
});

export default function DiagnosticBooking({ tutorId, defaultTrack = '' }) {
  const [slots, setSlots] = useState(null); // null = loading
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState({
    studentName: '',
    grade: '',
    parentName: '',
    email: '',
    phone: '',
    track: defaultTrack,
    website: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // booked slot
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!tutorId) {
      setSlots([]);
      return;
    }
    fetch(`/api/booking/slots?kind=diagnostic&tutorId=${tutorId}&days=42`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []))
      .catch(() => setSlots([]));
  }, [tutorId]);

  async function submit(e) {
    e.preventDefault();
    if (!picked) return;
    setMsg(null);
    setSaving(true);
    const res = await fetch('/api/booking/diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleId: picked.scheduleId,
        dateKey: picked.dateKey,
        studentName: form.studentName,
        grade: form.grade,
        parentName: form.parentName,
        email: form.email,
        phone: form.phone,
        track: form.track || undefined,
        // Literacy students are placed into a level from this visit, so their
        // confirmation still reads "Placement Test".
        purpose: form.track === 'language' ? 'placement' : 'diagnostic',
        website: form.website,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(d.error || 'Something went wrong. Please try again.');
      return;
    }
    setDone(picked);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Group open slots by date, keeping the API's chronological order.
  const byDate = [];
  for (const s of slots || []) {
    const last = byDate[byDate.length - 1];
    if (last && last.dateKey === s.dateKey) last.slots.push(s);
    else byDate.push({ dateKey: s.dateKey, dateLabel: s.dateLabel, slots: [s] });
  }

  if (done) {
    return (
      <div style={{ ...card(), textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>🌰</div>
        <h2 style={{ color: DARK, fontSize: '1.4rem', marginBottom: '0.5rem' }}>You&rsquo;re booked!</h2>
        <p style={{ color: BROWN, marginBottom: '0.5rem' }}>
          <strong>{done.dateLabel}</strong> · {done.timeLabel}
        </p>
        <p style={{ color: BROWN, margin: 0 }}>
          A confirmation is on its way to <strong>{form.email}</strong>. We look forward to meeting{' '}
          {form.studentName || 'your child'}!
        </p>
      </div>
    );
  }

  // Nothing open (or no diagnostic tutor configured): the request form keeps the
  // page useful instead of showing an empty slot list.
  if (slots !== null && byDate.length === 0) {
    return (
      <>
        <p style={{ color: BROWN, textAlign: 'center', margin: '0 auto 1.25rem', maxWidth: 560 }}>
          There are no open times on the calendar right now — send us a note below and we&rsquo;ll
          find a time together.
        </p>
        <DiagnosticRequest defaultTrack={defaultTrack} />
      </>
    );
  }

  return (
    <>
      {/* Step 1: pick a time */}
      <div style={card()}>
        <h2 style={{ color: DARK, fontSize: '1.15rem', margin: '0 0 0.3rem' }}>1. Pick a time</h2>
        <p style={{ color: '#9b8b77', fontSize: '0.88rem', margin: '0 0 1rem' }}>
          A <strong>30-minute assessment</strong> with Mrs.&nbsp;Jung followed by a{' '}
          <strong>15-minute parent consultation</strong> (45 minutes total). No account needed.
        </p>
        {slots === null ? (
          <p style={{ color: '#9b8b77', margin: 0 }}>Loading open times…</p>
        ) : (
          byDate.map((day) => (
            <div key={day.dateKey} style={{ marginBottom: '0.9rem' }}>
              <div style={{ fontWeight: 700, color: DARK, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                {day.dateLabel}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {day.slots.map((s) => {
                  const active =
                    picked && picked.scheduleId === s.scheduleId && picked.dateKey === s.dateKey;
                  return (
                    <button
                      key={`${s.scheduleId}-${s.dateKey}`}
                      type="button"
                      onClick={() => setPicked(s)}
                      style={{
                        border: active ? '2px solid #8b7355' : '1.5px solid #d8cdbd',
                        background: active ? '#8b7355' : '#fff',
                        color: active ? '#fff' : BROWN,
                        fontWeight: 600,
                        borderRadius: 8,
                        padding: '0.5rem 0.9rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                      }}
                    >
                      {s.timeLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Step 2: student & contact details */}
      <form onSubmit={submit} style={{ ...card(), marginBottom: '2rem', opacity: picked ? 1 : 0.55 }}>
        <h2 style={{ color: DARK, fontSize: '1.15rem', margin: '0 0 0.3rem' }}>2. Your details</h2>
        <p style={{ color: '#9b8b77', fontSize: '0.88rem', margin: '0 0 1.2rem' }}>
          {picked ? (
            <>
              Booking <strong>{picked.dateLabel}</strong> · {picked.timeLabel}
            </>
          ) : (
            'Pick a time above first.'
          )}
        </p>

        {/* Honeypot: humans never see or fill this. */}
        <div
          style={{ position: 'absolute', left: -9999, opacity: 0, height: 0, overflow: 'hidden' }}
          aria-hidden="true"
        >
          <label htmlFor="diag-website">Website</label>
          <input
            id="diag-website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
          />
        </div>

        <label style={lbl()}>Student Name *</label>
        <input style={inp()} value={form.studentName} onChange={(e) => set('studentName', e.target.value)} required />

        <label style={lbl()}>Student Grade *</label>
        <input style={inp()} value={form.grade} onChange={(e) => set('grade', e.target.value)} required />

        <label style={lbl()}>Which track? *</label>
        <select style={inp()} value={form.track} onChange={(e) => set('track', e.target.value)} required>
          <option value="">Select one</option>
          <option value="language">Literacy (English &amp; Korean)</option>
          <option value="math">Math &amp; Test Prep</option>
          <option value="both">Both</option>
        </select>

        <label style={lbl()}>Parent/Guardian Name *</label>
        <input style={inp()} value={form.parentName} onChange={(e) => set('parentName', e.target.value)} required />

        <label style={lbl()}>Email Address *</label>
        <input type="email" style={inp()} value={form.email} onChange={(e) => set('email', e.target.value)} required />

        <label style={lbl()}>Phone Number</label>
        <input type="tel" style={inp()} value={form.phone} onChange={(e) => set('phone', e.target.value)} />

        {msg ? <p style={{ color: '#a3261a', fontWeight: 600 }}>{msg}</p> : null}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!picked || saving}
          style={{ flex: 'none', padding: '0.85rem 2.25rem' }}
        >
          {saving ? 'Booking…' : 'Book my free assessment'}
        </button>
        <p style={{ color: '#9b8b77', fontSize: '0.85rem', margin: '0.75rem 0 0' }}>
          Free · 45 minutes · no obligation. Prefer to talk first?{' '}
          <Link href="/contact" style={{ color: '#8b7355', fontWeight: 700 }}>
            Contact us
          </Link>
          .
        </p>
      </form>
    </>
  );
}
