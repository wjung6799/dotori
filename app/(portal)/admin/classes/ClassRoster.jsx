'use client';

import { useCallback, useEffect, useState } from 'react';

// The roster for one class, plus the form that puts a student in it.
//
// This lives on the class catalog because that is where someone stands when
// they decide a student should join: the legacy /admin page has the same form
// buried inside an Enrollments tab, which nobody thinks to open while looking
// at a class.
//
// Adding an unpaid seat is what raises the invoice — the POST route creates it
// and emails the family — so the wording here has to make the billing
// consequence obvious before the button is pressed.

const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export default function ClassRoster({ cls, onChanged }) {
  const [roster, setRoster] = useState(null); // null = loading
  const [families, setFamilies] = useState([]);
  const [userId, setUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [markPaid, setMarkPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type, text }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/enrollments?classId=${cls._id}`);
      const data = res.ok ? await res.json() : { enrollments: [] };
      setRoster((data.enrollments || []).filter((e) => e.paymentStatus !== 'refunded'));
    } catch {
      setRoster([]);
    }
  }, [cls._id]);

  useEffect(() => {
    load();
    fetch('/api/admin/families')
      .then((r) => (r.ok ? r.json() : { families: [] }))
      .then((d) => setFamilies(d.families || []))
      .catch(() => setFamilies([]));
  }, [load]);

  const family = families.find((f) => String(f._id) === userId) || null;
  const students = (family?.students || []).filter((s) => s.name);
  // A student already in this class must not be offered again; the route would
  // reject it, but showing the name is a worse error than not showing it.
  const seated = new Set((roster || []).map((e) => e.studentName));
  const selectable = students.filter((s) => !seated.has(s.name));

  const famLabel = (f) => {
    const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
    const kids = (f.students || []).map((s) => s.name).filter(Boolean).join(', ');
    return kids ? `${base} — ${kids}` : base;
  };

  async function add(e) {
    e.preventDefault();
    if (busy || !userId || !studentName) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          classId: cls._id,
          studentName,
          paymentStatus: markPaid ? 'paid' : 'pending',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not enroll that student.');

      setMsg({
        type: 'ok',
        text: data.invoice
          ? `${studentName} is enrolled. Invoice ${data.invoice.number} for ${money(
              data.invoice.subtotalCents / 100,
            )} has been emailed to the family.`
          : `${studentName} is enrolled. ${data.invoiceNote || ''}`.trim(),
      });
      setStudentName('');
      await load();
      onChanged?.();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const taken = roster?.length ?? 0;
  const full = taken >= (cls.capacity ?? 0);

  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius-sm)',
        padding: '1rem 1.15rem',
        marginTop: '0.6rem',
      }}
    >
      <div className="card-head" style={{ marginBottom: '0.7rem' }}>
        <h2 style={{ fontSize: '0.95rem' }}>
          {cls.name} <span className="muted small">· {taken} of {cls.capacity} seats</span>
        </h2>
      </div>

      {msg ? <div className={`notice ${msg.type}`}>{msg.text}</div> : null}

      {roster === null ? (
        <p className="muted small mb0">Loading the roster…</p>
      ) : roster.length === 0 ? (
        <p className="muted small">Nobody is enrolled in this class yet.</p>
      ) : (
        <div className="stack" style={{ marginBottom: '0.9rem' }}>
          {roster.map((en) => (
            <div className="row" key={String(en._id)} style={{ background: 'var(--surface)' }}>
              <span className="main">
                <span className="strong">{en.studentName}</span>
                <span className="meta">
                  {' · '}
                  {[en.userId?.firstName, en.userId?.lastName].filter(Boolean).join(' ') ||
                    en.userId?.name ||
                    en.userId?.email ||
                    'family'}
                </span>
              </span>
              <span className={`pill ${en.paymentStatus === 'paid' ? 'ok' : 'warn'}`}>
                {en.paymentStatus === 'paid' ? 'Paid' : 'Awaiting payment'}
              </span>
            </div>
          ))}
        </div>
      )}

      {full ? (
        <p className="muted small mb0">
          This class is full. Raise the capacity in the class settings before adding anyone else.
        </p>
      ) : (
        <form onSubmit={add}>
          <div className="grid-tight" style={{ alignItems: 'start' }}>
            <div className="field mb0">
              <label htmlFor={`fam-${cls._id}`}>Family</label>
              <select
                id={`fam-${cls._id}`}
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setStudentName('');
                }}
                required
              >
                <option value="">Select a family…</option>
                {families.map((f) => (
                  <option key={String(f._id)} value={String(f._id)}>
                    {famLabel(f)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field mb0">
              <label htmlFor={`stu-${cls._id}`}>Student</label>
              <select
                id={`stu-${cls._id}`}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
                disabled={!family}
              >
                <option value="">{family ? 'Select a student…' : 'Pick a family first'}</option>
                {selectable.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                    {s.grade ? ` (${s.grade})` : ''}
                  </option>
                ))}
              </select>
              {family && students.length === 0 ? (
                <p className="hint">This family has not added any students yet.</p>
              ) : null}
              {family && students.length > 0 && selectable.length === 0 ? (
                <p className="hint">Every student in this family is already in this class.</p>
              ) : null}
            </div>

            <div className="field mb0">
              <button type="submit" className="btn btn-primary" disabled={busy || !studentName}>
                {busy ? 'Adding…' : 'Add to class'}
              </button>
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.7rem',
              fontSize: '0.85rem',
              color: 'var(--ink-2)',
            }}
          >
            <input
              type="checkbox"
              checked={markPaid}
              onChange={(e) => setMarkPaid(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Already paid (Zelle, check, cash) — skip the invoice
          </label>

          <p className="muted small" style={{ margin: '0.5rem 0 0' }}>
            {markPaid
              ? 'The seat is recorded as settled and nothing is billed.'
              : cls.price > 0
                ? `An invoice for ${money(cls.price)} is raised and emailed to the family, and they pay it in their portal.`
                : 'This class has no price, so no invoice will be raised. Set tuition above if the family should be billed.'}
          </p>
        </form>
      )}
    </div>
  );
}
