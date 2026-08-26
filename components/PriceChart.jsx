import {
  GROUP_CLASS_TUITION,
  LESSON_FORMATS,
  LESSON_PACKAGES,
  LESSON_POLICY,
  PRICING_FAQ,
  TERM,
  formatUsd,
} from '@/lib/pricing';

// Presentational tuition chart — the published schedule & tuition sheet, in the
// shape a page can drop in. Not on a public route today; reuse it in the family
// dashboard payment flow (build the interactive "choose a plan" UI there from
// lib/pricing.js's numeric fields). Pure and server-compatible: no client state,
// no CTAs baked in.
//
// Everything here reads from lib/pricing.js, so a price is corrected in one
// place and this follows.

const cell = { padding: '0.75rem 0.9rem', borderBottom: '1px solid #f0e9df', color: '#6b5b47' };
const head = { background: '#5d4a35', color: '#fff', textAlign: 'left', padding: '0.7rem 0.9rem', fontWeight: 600 };
const money = { textAlign: 'right', fontWeight: 800, color: '#1e7a40', whiteSpace: 'nowrap' };

export default function PriceChart({ showPrivate = true, showPolicy = true, showFaq = true }) {
  return (
    <div>
      <h2 style={{ textAlign: 'left', fontSize: '1.5rem', color: '#4a3c28', margin: '0 0 0.25rem' }}>
        Group Classes
      </h2>
      <p style={{ color: '#a0906f', fontSize: '0.85rem', margin: '0 0 1rem' }}>
        Each quarter runs {TERM.weeks} weeks · {TERM.sessionsPerClass} sessions per class
      </p>

      <div style={{ overflowX: 'auto', borderRadius: 12, boxShadow: '0 8px 20px rgba(139,115,85,0.08)', marginBottom: '2.5rem' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', background: '#fff', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={head}>Program</th>
              <th style={head}>Length</th>
              <th style={head}>Sessions</th>
              <th style={{ ...head, textAlign: 'right' }}>Tuition per Quarter</th>
            </tr>
          </thead>
          <tbody>
            {GROUP_CLASS_TUITION.map((p) => (
              <tr key={p.id}>
                <td style={cell}>
                  <div style={{ fontWeight: 700, color: '#4a3c28' }}>{p.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#a0906f' }}>{p.levels}</div>
                </td>
                <td style={cell}>{p.minutes} min</td>
                <td style={cell}>{p.sessions}</td>
                <td style={{ ...cell, ...money }}>
                  {formatUsd(p.priceCents)}
                  {p.materialsFeeCents > 0 ? (
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a0906f' }}>
                      plus {formatUsd(p.materialsFeeCents)} materials fee
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPrivate && (
        <>
          <h2 style={{ textAlign: 'left', fontSize: '1.5rem', color: '#4a3c28', margin: '0 0 1rem' }}>
            Private &amp; Semi-Private Lessons
          </h2>

          <div className="programs-grid" style={{ marginBottom: '1rem' }}>
            {LESSON_FORMATS.map((f) => (
              <div key={f.id} className="program-card">
                <h3 style={{ margin: 0 }}>{f.name}</h3>
                <p style={{ color: '#6b5b47', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                  {f.students} · {f.availability}
                </p>
              </div>
            ))}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 12, boxShadow: '0 8px 20px rgba(139,115,85,0.08)' }}>
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', background: '#fff', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={head}>Package</th>
                  {LESSON_FORMATS.map((f) => (
                    <th key={f.id} style={{ ...head, textAlign: 'right' }}>{f.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LESSON_PACKAGES.map((p) => (
                  <tr key={p.id}>
                    <td style={cell}>
                      <div style={{ fontWeight: 700, color: '#4a3c28' }}>{p.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#a0906f' }}>{p.blurb}</div>
                    </td>
                    {LESSON_FORMATS.map((f) => {
                      const r = p.rates[f.id];
                      return (
                        <td key={f.id} style={{ ...cell, ...money }}>
                          ${r.ratePerHour}
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a0906f' }}>
                            per hour{p.sessions > 1 ? ` · ${r.hours} hours` : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ color: '#a0906f', fontSize: '0.8rem', margin: '0.7rem 0 2.5rem' }}>
            All rates are per hour. Hours are purchased in advance and deducted as you book, and the
            rate is set by the size of the package you purchase.
          </p>
        </>
      )}

      {showPolicy && (
        <div className="faq-section">
          <h2>Payment, Rescheduling &amp; Refunds</h2>
          <ul style={{ color: '#6b5b47', lineHeight: 1.7, paddingLeft: '1.1rem', margin: 0 }}>
            {LESSON_POLICY.map((r) => (
              <li key={r.q} style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: '#4a3c28' }}>{r.q}.</strong> {r.a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showFaq && (
        <div className="faq-section">
          <h2>Questions, answered</h2>
          {PRICING_FAQ.map((f) => (
            <details key={f.q} className="faq-item" style={{ padding: '0.25rem 0' }}>
              <summary style={{ padding: '1.25rem 0', cursor: 'pointer', fontWeight: 600, color: '#4a3c28', listStyle: 'none' }}>
                {f.q}
              </summary>
              <p style={{ color: '#6b5b47', lineHeight: 1.7, paddingBottom: '1.25rem' }}>{f.a}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
