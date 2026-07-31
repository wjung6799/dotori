import { SEMI_PRIVATE_PACKAGES, PRIVATE_RATE, PRICING_FAQ } from '@/lib/pricing';

// Presentational pricing chart, decoupled from any page. Not on a public route
// today; reuse it in the family dashboard payment flow (build the interactive
// "choose a plan" UI there from lib/pricing.js's numeric fields). Pure and
// server-compatible: no client state, no CTAs baked in.
export default function PriceChart({ showPrivate = true, showFaq = true }) {
  return (
    <div>
      <div className="programs-grid">
        {SEMI_PRIVATE_PACKAGES.map((p) => (
          <div
            key={p.id}
            className="program-card"
            style={p.highlight ? { border: '2px solid #8b7355' } : undefined}
          >
            <div className="program-badge">{p.tag}</div>
            <h3>{p.name}</h3>
            <div className="program-price">
              {p.price}
              <span style={{ fontSize: '1rem', WebkitTextFillColor: '#6b5b47', color: '#6b5b47' }}>{p.unit}</span>
            </div>
            <ul className="program-features">
              {p.lines.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
        ))}
      </div>

      {showPrivate && (
        <div
          className="learning-path"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ flex: '1 1 320px' }}>
            <h2 style={{ textAlign: 'left', fontSize: '1.8rem', marginBottom: '0.5rem' }}>{PRIVATE_RATE.name}</h2>
            <p style={{ color: '#6b5b47' }}>
              <strong>{PRIVATE_RATE.price}{PRIVATE_RATE.unit}, {PRIVATE_RATE.availability}.</strong> {PRIVATE_RATE.blurb}
            </p>
          </div>
          <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
            <div className="program-price" style={{ fontSize: '2.6rem' }}>
              {PRIVATE_RATE.price}
              <span style={{ fontSize: '1rem', WebkitTextFillColor: '#6b5b47', color: '#6b5b47' }}>{PRIVATE_RATE.unit}</span>
            </div>
            <div style={{ color: '#9b8b77', fontWeight: 600 }}>{PRIVATE_RATE.availability}</div>
          </div>
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
