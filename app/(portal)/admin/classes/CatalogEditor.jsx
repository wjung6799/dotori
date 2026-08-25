'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { defaultOnlineFeeCents } from '@/lib/pricing';
import ClassRoster from './ClassRoster';

const QUARTERS = [
  ['fall-2025', 'Fall 2025'],
  ['winter-2026', 'Winter 2026'],
  ['spring-2026', 'Spring 2026'],
  ['summer-2026', 'Summer 2026'],
  ['fall-2026', 'Fall 2026'],
  ['winter-2027', 'Winter 2027'],
  ['spring-2027', 'Spring 2027'],
  ['summer-2027', 'Summer 2027'],
];

const CATEGORIES = [
  ['reading', 'Reading'],
  ['writing', 'Writing'],
  ['korean', 'Korean'],
  ['1on1', '1:1'],
  ['summer', 'Summer Camp'],
];

const quarterLabel = (q) => QUARTERS.find(([k]) => k === q)?.[1] || q;
const categoryLabel = (c) => CATEGORIES.find(([k]) => k === c)?.[1] || c;

const money = (n) =>
  n === null || n === undefined || n === ''
    ? '—'
    : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

const BLANK = {
  name: '',
  category: 'reading',
  quarter: 'fall-2026',
  schedule: '',
  description: '',
  price: '',
  earlyBirdPrice: '',
  priceMax: '',
  onlineFee: '',
  capacity: 4,
  scheduleKey: '',
  manualEnrolled: '',
  active: true,
};

export default function CatalogEditor({ literacySlots }) {
  const [classes, setClasses] = useState(null); // null = loading
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // class id, 'new', or null
  const [form, setForm] = useState(BLANK);
  const [msg, setMsg] = useState(null); // { type, text }
  const [busy, setBusy] = useState(false);

  // Which class's roster is open. One at a time: each one fetches its own
  // enrollments, and opening every row would hammer the API for nothing.
  const [rosterFor, setRosterFor] = useState(null);

  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/classes');
      if (!res.ok) throw new Error('Could not load the catalog.');
      const data = await res.json();
      setClasses(data.classes || []);
    } catch (err) {
      setClasses([]);
      setMsg({ type: 'err', text: err.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // The online fee follows the tuition unless someone has typed their own. It is
  // charged as a fixed dollar amount, so it has to be a real stored number
  // rather than a rate applied at checkout.
  function setPrice(v) {
    setForm((f) => {
      const autoBefore = f.price === '' ? '' : String(defaultOnlineFeeCents(Math.round(Number(f.price) * 100)) / 100);
      const untouched = f.onlineFee === '' || f.onlineFee === autoBefore;
      const nextAuto = v === '' ? '' : String(defaultOnlineFeeCents(Math.round(Number(v) * 100)) / 100);
      return { ...f, price: v, onlineFee: untouched ? nextAuto : f.onlineFee };
    });
  }

  function startNew() {
    setForm({ ...BLANK, quarter: filter === 'all' ? BLANK.quarter : filter });
    setEditing('new');
    setMsg(null);
  }

  function startEdit(c) {
    setForm({
      name: c.name || '',
      category: c.category || 'reading',
      quarter: c.quarter || 'fall-2026',
      schedule: c.schedule || '',
      description: c.description || '',
      price: c.price ?? '',
      earlyBirdPrice: c.earlyBirdPrice ?? '',
      priceMax: c.priceMax ?? '',
      onlineFee: c.onlineFeeCents === null || c.onlineFeeCents === undefined ? '' : c.onlineFeeCents / 100,
      capacity: c.capacity ?? 4,
      scheduleKey: c.scheduleKey || '',
      manualEnrolled: c.manualEnrolled ?? '',
      active: c.active !== false,
    });
    setEditing(c._id);
    setMsg(null);
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const payload = {
      ...form,
      price: form.price === '' ? 0 : Number(form.price),
      // Blank means "use the automatic 3%"; the API recomputes it from the price.
      onlineFeeCents: form.onlineFee === '' ? '' : Math.round(Number(form.onlineFee) * 100),
      capacity: Number(form.capacity) || 1,
      manualEnrolled: form.manualEnrolled === '' ? null : Number(form.manualEnrolled),
    };
    try {
      const isNew = editing === 'new';
      const res = await fetch(isNew ? '/api/admin/classes' : `/api/admin/classes/${editing}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed.');
      setEditing(null);
      setMsg({ type: 'ok', text: isNew ? 'Class added.' : 'Class updated.' });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(c) {
    if (c.enrolledCount > 0) {
      setMsg({
        type: 'err',
        text: `${c.name} has ${c.enrolledCount} enrolled student${c.enrolledCount === 1 ? '' : 's'}. Deactivate it instead of deleting, so their records survive.`,
      });
      return;
    }
    if (!window.confirm(`Delete "${c.name}" (${quarterLabel(c.quarter)})? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/classes/${c._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed.');
      setMsg({ type: 'ok', text: 'Class deleted.' });
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c) {
    setBusy(true);
    try {
      await fetch(`/api/admin/classes/${c._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !c.active }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copyTerm(e) {
    e.preventDefault();
    if (!copyFrom || !copyTo || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/classes/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromQuarter: copyFrom, toQuarter: copyTo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Copy failed.');
      setMsg({
        type: 'ok',
        text: `Copied ${data.created} class${data.created === 1 ? '' : 'es'} into ${quarterLabel(copyTo)}${data.skipped ? `, skipped ${data.skipped} that already existed` : ''}. Check the prices before opening enrollment.`,
      });
      setFilter(copyTo);
      await load();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => {
    const list = classes || [];
    return filter === 'all' ? list : list.filter((c) => c.quarter === filter);
  }, [classes, filter]);

  // Active classes at $0 are the reason a family cannot pay online, so surface
  // them as a single actionable count rather than making someone scan the table.
  const unpriced = (classes || []).filter((c) => c.active && !(c.price > 0));

  const termsInUse = useMemo(() => {
    const seen = new Set((classes || []).map((c) => c.quarter));
    return QUARTERS.filter(([k]) => seen.has(k));
  }, [classes]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Class catalog</h1>
          <p className="lede">
            Build a term, set tuition, and open it for enrollment in the family portal.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startNew}>
          + New class
        </button>
      </div>

      {msg ? <div className={`notice ${msg.type}`}>{msg.text}</div> : null}

      {unpriced.length > 0 ? (
        <div className="notice warn">
          <strong>{unpriced.length}</strong> active class{unpriced.length === 1 ? ' has' : 'es have'} no
          price set. Families cannot pay for {unpriced.length === 1 ? 'it' : 'them'} online — the portal
          shows a “contact the school” message instead. Set a price above $0 to open card payment.
        </div>
      ) : null}

      {/* ── Editor ─────────────────────────────────────────────── */}
      {editing ? (
        <div className="card">
          <div className="card-head">
            <h2>{editing === 'new' ? 'New class' : 'Edit class'}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>

          <form onSubmit={save}>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="cl-name">Class name</label>
                <input
                  id="cl-name"
                  required
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Core Literacy (Acorn) - Mon"
                />
              </div>
              <div className="field">
                <label htmlFor="cl-sched">Schedule</label>
                <input
                  id="cl-sched"
                  value={form.schedule}
                  onChange={(e) => set('schedule', e.target.value)}
                  placeholder="Mon 4:30-5:50"
                />
                <p className="hint">
                  Writing two options as “Mon 4:30-5:50 or Wed 4:00-5:20” makes the portal ask the
                  parent to pick a day at enrollment.
                </p>
              </div>
            </div>

            <div className="grid-tight">
              <div className="field">
                <label htmlFor="cl-cat">Category</label>
                <select id="cl-cat" value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {CATEGORIES.map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="cl-q">Term</label>
                <select id="cl-q" value={form.quarter} onChange={(e) => set('quarter', e.target.value)}>
                  {QUARTERS.map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="cl-cap">Capacity</label>
                <input
                  id="cl-cap"
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => set('capacity', e.target.value)}
                />
              </div>
            </div>

            <div className="grid-tight">
              <div className="field">
                <label htmlFor="cl-price">Tuition ($)</label>
                <input
                  id="cl-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="350"
                />
                <p className="hint">$0 means no online payment.</p>
              </div>
              <div className="field">
                <label htmlFor="cl-fee">Online card fee ($)</label>
                <input
                  id="cl-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.onlineFee}
                  onChange={(e) => set('onlineFee', e.target.value)}
                  placeholder="auto"
                />
                <p className="hint">
                  Fills in at 3% of tuition. Overwrite it, or clear it to go back to automatic.
                  Families who pay by Zelle or check are never charged it.
                </p>
              </div>
              <div className="field">
                <label htmlFor="cl-early">Early-bird ($)</label>
                <input
                  id="cl-early"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.earlyBirdPrice}
                  onChange={(e) => set('earlyBirdPrice', e.target.value)}
                  placeholder="optional"
                />
              </div>
              <div className="field">
                <label htmlFor="cl-max">Price ceiling ($)</label>
                <input
                  id="cl-max"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.priceMax}
                  onChange={(e) => set('priceMax', e.target.value)}
                  placeholder="for ranges, e.g. 1:1"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="cl-desc">Description</label>
              <textarea
                id="cl-desc"
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="What families see on the class card in the portal."
              />
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="cl-slot">Literacy schedule slot</label>
                <select
                  id="cl-slot"
                  value={form.scheduleKey}
                  onChange={(e) => set('scheduleKey', e.target.value)}
                >
                  <option value="">Not on the literacy schedule</option>
                  {literacySlots.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <p className="hint">Feeds the live seat count on the public Programs page.</p>
              </div>
              <div className="field">
                <label htmlFor="cl-manual">Seat count override</label>
                <input
                  id="cl-manual"
                  type="number"
                  min="0"
                  value={form.manualEnrolled}
                  onChange={(e) => set('manualEnrolled', e.target.value)}
                  placeholder="blank = count real enrollments"
                />
                <p className="hint">Use when students were enrolled outside the site.</p>
              </div>
            </div>

            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => set('active', e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Active (visible to families)
              </label>
            </div>

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing === 'new' ? 'Add class' : 'Save changes'}
            </button>
          </form>
        </div>
      ) : null}

      {/* ── Catalog table ──────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>
            {filter === 'all' ? 'All terms' : quarterLabel(filter)}{' '}
            <span className="muted small">({shown.length})</span>
          </h2>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by term"
          >
            <option value="all">All terms</option>
            {QUARTERS.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>

        {classes === null ? (
          <div className="empty">
            <p>Loading the catalog…</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">📚</span>
            <p>No classes in this term yet. Add one, or copy a previous term below.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Term</th>
                  <th>Schedule</th>
                  <th className="num">Tuition</th>
                  <th className="num">Seats</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const taken = c.manualEnrolled ?? c.enrolledCount ?? 0;
                  const full = taken >= (c.capacity ?? 0);
                  return (
                    <Fragment key={c._id}>
                    <tr>
                      <td>
                        <span className="strong">{c.name}</span>
                        <div className="muted small">{categoryLabel(c.category)}</div>
                      </td>
                      <td className="nowrap">{quarterLabel(c.quarter)}</td>
                      <td>{c.schedule || <span className="muted">—</span>}</td>
                      <td className="num">
                        {c.price > 0 ? (
                          <>
                            {money(c.price)}
                            {c.priceMax ? <span className="muted">–{money(c.priceMax)}</span> : null}
                            {c.earlyBirdPrice ? (
                              <div className="muted small">early {money(c.earlyBirdPrice)}</div>
                            ) : null}
                            <div className="muted small">
                              +{money((c.onlineFeeCents ?? defaultOnlineFeeCents(Math.round(c.price * 100))) / 100)} card fee
                            </div>
                          </>
                        ) : (
                          <span className="pill warn">No price</span>
                        )}
                      </td>
                      <td className="num">
                        {taken}/{c.capacity}
                        {c.manualEnrolled !== null && c.manualEnrolled !== undefined ? (
                          <div className="muted small">override</div>
                        ) : null}
                      </td>
                      <td>
                        {!c.active ? (
                          <span className="pill mute">Hidden</span>
                        ) : full ? (
                          <span className="pill err">Full</span>
                        ) : (
                          <span className="pill ok">Open</span>
                        )}
                      </td>
                      <td className="nowrap">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setRosterFor(rosterFor === c._id ? null : c._id)}
                        >
                          {rosterFor === c._id ? 'Hide students' : 'Students'}
                        </button>{' '}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>
                          Edit
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleActive(c)}
                          disabled={busy}
                        >
                          {c.active ? 'Hide' : 'Show'}
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => remove(c)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {rosterFor === c._id ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '0 0.7rem 0.9rem' }}>
                          <ClassRoster cls={c} onChanged={load} />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Copy a term ────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Start a new term from an old one</h2>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Copies every class in the source term — name, schedule, tuition, capacity — into the target
          term. Classes that already exist there by name are skipped, so running it twice is safe.
        </p>
        <form onSubmit={copyTerm} className="grid-tight" style={{ alignItems: 'end' }}>
          <div className="field mb0">
            <label htmlFor="cp-from">Copy from</label>
            <select id="cp-from" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} required>
              <option value="">Select a term…</option>
              {termsInUse.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field mb0">
            <label htmlFor="cp-to">Copy into</label>
            <select id="cp-to" value={copyTo} onChange={(e) => setCopyTo(e.target.value)} required>
              <option value="">Select a term…</option>
              {QUARTERS.map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field mb0">
            <button type="submit" className="btn btn-accent" disabled={busy || !copyFrom || !copyTo}>
              Copy term
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
