'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';

// Presentational + interactive part of the Programs page. Everything — heading,
// intro, Korean tab label, AND the program cards — comes from the CMS (see
// page.jsx). introHtml is pre-rendered HTML from the server (no lexical code in
// this bundle); `programs` is the array of card objects.
export default function ProgramsClient({ heading, introHtml, koreanTabLabel, programs = [] }) {
  const [activeCategory, setActiveCategory] = useState('reading');

  const cardStyle = (category) => ({
    display: category === activeCategory ? 'block' : 'none',
    animation: category === activeCategory ? 'fadeInUp 0.6s ease-out' : '',
  });

  return (
    <>
      <main>
        <div className="container">
          <div className="page-header">
            <h1>{heading}</h1>
            {introHtml ? (
              <div style={{ textAlign: 'left' }} dangerouslySetInnerHTML={{ __html: introHtml }} />
            ) : (
              <p style={{ textAlign: 'left' }}>Dotori&rsquo;s Language track is built around <strong>English reading and writing</strong> &mdash; strong literacy is the heart of everything we do, from early readers to confident writers. For families who also want to keep the Korean language alive, we offer <strong>Korean classes on the side</strong>. Every class is small-group, with a personalized lesson plan for each student.</p>
            )}
          </div>

          <div className="filter-tabs">
            <div
              className={`filter-tab${activeCategory === 'reading' ? ' active' : ''}`}
              onClick={() => setActiveCategory('reading')}
            >
              Reading
            </div>
            <div
              className={`filter-tab${activeCategory === 'writing' ? ' active' : ''}`}
              onClick={() => setActiveCategory('writing')}
            >
              Writing
            </div>
            <div
              className={`filter-tab${activeCategory === 'creative' ? ' active' : ''}`}
              onClick={() => setActiveCategory('creative')}
            >
              {koreanTabLabel}
            </div>
            <div
              className={`filter-tab${activeCategory === 'tutor' ? ' active' : ''}`}
              onClick={() => setActiveCategory('tutor')}
            >
              1:1
            </div>
            <div
              className={`filter-tab${activeCategory === 'summer' ? ' active' : ''}`}
              onClick={() => setActiveCategory('summer')}
            >
              Summer Camp
            </div>
          </div>

          <div className="programs-grid" id="programsGrid">
            {programs.map((p, idx) => (
              <div key={idx} className="program-card animate-in" data-category={p.category} style={cardStyle(p.category)}>
                <h3>{p.title}</h3>
                {p.duration ? <div className="program-duration">{p.duration}</div> : null}

                {p.features && p.features.length > 0 ? (
                  <ul className="program-features">
                    {p.features.map((f, i) => <li key={i}>{f.text}</li>)}
                  </ul>
                ) : null}

                {p.schedule ? (
                  <div className="program-schedule" style={{ margin: '1rem 0', padding: '0.75rem', background: '#f8f6f3', borderRadius: 8, fontSize: '0.9rem' }}>
                    📅 <strong>{p.scheduleTitle}</strong><br />
                    {p.schedule.split('\n').map((line, i, arr) => (
                      <Fragment key={i}>{line}{i < arr.length - 1 ? <br /> : null}</Fragment>
                    ))}
                  </div>
                ) : null}

                {p.ctas && p.ctas.length > 0 ? (
                  <div className="program-cta" style={{ display: 'flex', gap: '0.5rem' }}>
                    {p.ctas.map((cta, i) => <CtaButton key={i} cta={cta} />)}
                  </div>
                ) : null}

                {p.curriculumLinks && p.curriculumLinks.length > 0 ? (
                  <>
                    <div style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600, color: '#4a3c28', fontSize: '0.95rem' }}>
                      {p.curriculumHeading}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {p.curriculumLinks.map((l, i) => (
                        <a key={i} href={l.href} className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>
                          {l.label}
                        </a>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

// One CTA button. Internal app links (e.g. /diagnostic) use Next's Link;
// file paths and external URLs use a plain anchor (with download when flagged).
function CtaButton({ cta }) {
  const cls = `btn btn-${cta.style || 'primary'}`;
  const style = { flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const href = cta.href || '#';
  const isInternal = href.startsWith('/') && !href.startsWith('/assets');
  if (isInternal) {
    return <Link href={href} className={cls} style={style}>{cta.label}</Link>;
  }
  const linkProps = cta.download ? { download: true } : { target: '_blank', rel: 'noreferrer' };
  return <a href={href} className={cls} style={style} {...linkProps}>{cta.label}</a>;
}
