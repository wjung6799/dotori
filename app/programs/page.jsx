'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ProgramsPage() {
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
            <h1>Our Programs</h1>
            <p style={{ textAlign: 'left' }}>Choose from our comprehensive range of programs in Reading, Writing, and Korean Language—each designed to spark curiosity, strengthen literacy, and develop critical thinking. At Dotori School, we blend rich content with engaging instruction to help students grow in confidence, communication, and a love of learning.</p>
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
              Korean
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
            <div className="program-card animate-in" data-category="tutor" style={cardStyle('tutor')}>
              <h3>1:1 Tutoring</h3>
              <div className="program-duration">Flexible scheduling with the instructor</div>
              <ul className="program-features">
                <li>Arrange sessions directly with the instructor to fit your schedule</li>
                <li>Personalized support in any academic area</li>
                <li>Tailored lessons to meet each student&rsquo;s unique needs</li>
              </ul>
              <div className="program-cta">
                <Link href="/contact" className="btn btn-primary" style={{ width: '100%', textAlign: 'center' }}>Contact Us for More Information</Link>
              </div>
            </div>

            <div className="program-card animate-in" data-category="reading" style={cardStyle('reading')}>
              <h3>Book Club</h3>
              <div className="program-duration">10 weeks · 1 class/week · 90 minutes · Max 4 students/class</div>
              <div className="program-schedule" style={{ margin: '1rem 0', padding: '0.75rem', background: '#f8f6f3', borderRadius: 8, fontSize: '0.9rem' }}>
                📅 <strong>Class Schedule</strong><br />
                🟢 K–1 · Wed · 4:00–5:00 PM<br />
                🔵 Gr. 2–3 · Mon <em>or</em> Thu · 5:00–6:30 PM (choose one day)<br />
                🟣 Gr. 4–5 · Thu · 6:30–8:00 PM
              </div>
              <div className="program-cta" style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/assets/pdf/bookclub_english.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Course Description (English)</a>
                <a href="/assets/pdf/bookclub_korean.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>수업 안내 (한국어)</a>
              </div>
              <div style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600, color: '#4a3c28', fontSize: '0.95rem' }}>Spring 2026 Curriculum</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href="/assets/pdf/curriculum_bookclub_k1.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>K–1 (Wed)</a>
                <a href="/assets/pdf/curriculum_bookclub_23_mon.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Gr. 2–3 (Mon)</a>
                <a href="/assets/pdf/curriculum_bookclub_23_thu.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Gr. 2–3 (Thu)</a>
                <a href="/assets/pdf/curriculum_bookclub_45.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Gr. 4–5 (Thu)</a>
              </div>
            </div>

            <div className="program-card animate-in" data-category="reading" style={cardStyle('reading')}>
              <h3>Reading Comprehension</h3>
              <div className="program-duration">10 weeks · 1 class/week · 60 minutes · Max 4 students/class</div>
              <div className="program-schedule" style={{ margin: '1rem 0', padding: '0.75rem', background: '#f8f6f3', borderRadius: 8, fontSize: '0.9rem' }}>
                📅 <strong>Class Schedule</strong><br />
                🔵 Gr. 2–3 · Tue · 6:00–7:00 PM<br />
                🟣 Gr. 4–5 · Wed · 7:00–8:00 PM
              </div>
              <div className="program-cta" style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/assets/pdf/reading_english.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Course Description (English)</a>
                <a href="/assets/pdf/reading_korean.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>수업 안내 (한국어)</a>
              </div>
              <div style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600, color: '#4a3c28', fontSize: '0.95rem' }}>Spring 2026 Curriculum</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href="/assets/pdf/curriculum_reading_23.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Gr. 2–3 (Tue)</a>
                <a href="/assets/pdf/curriculum_reading_45.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Gr. 4–5 (Wed)</a>
              </div>
            </div>

            <div className="program-card animate-in" data-category="writing" style={cardStyle('writing')}>
              <h3>Foundational Writing</h3>
              <div className="program-duration">10 weeks · 1 class/week · 60 minutes · Max 4 students/class</div>
              <div className="program-schedule" style={{ margin: '1rem 0', padding: '0.75rem', background: '#f8f6f3', borderRadius: 8, fontSize: '0.9rem' }}>
                📅 <strong>Class Schedule</strong><br />
                🔵 Gr. 2–3 · Tue · 4:00–5:00 PM (Persuasive Writing)<br />
                🔵 Gr. 2–3 · Tue · 5:00–6:00 PM (Narrative Writing)<br />
                🟣 Gr. 4–5 · Mon · 7:30–8:30 PM
              </div>
              <div className="program-cta" style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/assets/pdf/writing_english.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Course Description (English)</a>
                <a href="/assets/pdf/writing_korean.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>수업 안내 (한국어)</a>
              </div>
              <div style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600, color: '#4a3c28', fontSize: '0.95rem' }}>Spring 2026 Curriculum</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href="/assets/pdf/curriculum_writing_23_persuasive.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Gr. 2–3 Persuasive (Tue)</a>
                <a href="/assets/pdf/curriculum_writing_23_narrative.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Gr. 2–3 Narrative (Tue)</a>
                <a href="/assets/pdf/curriculum_writing_45.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Gr. 4–5 (Mon)</a>
              </div>
            </div>

            <div className="program-card animate-in" data-category="writing" style={cardStyle('writing')}>
              <h3>Writer&rsquo;s Workshop</h3>
              <div className="program-duration">10 weeks · 1 class/week · 90 minutes · Max 4 students/class</div>
              <div className="program-schedule" style={{ margin: '1rem 0', padding: '0.75rem', background: '#f8f6f3', borderRadius: 8, fontSize: '0.9rem' }}>
                📅 <strong>Class Schedule</strong><br />
                🟣 Gr. 3–6 · Sat · 1:30–3:00 PM
              </div>
              <div className="program-cta" style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/assets/pdf/workshop_english.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Course Description (English)</a>
                <a href="/assets/pdf/workshop_korean.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>수업 안내 (한국어)</a>
              </div>
              <div style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600, color: '#4a3c28', fontSize: '0.95rem' }}>Spring 2026 Curriculum</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href="/assets/pdf/curriculum_workshop.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Gr. 3–6 (Sat)</a>
              </div>
            </div>

            <div className="program-card animate-in" data-category="creative" style={cardStyle('creative')}>
              <h3>K-1 Hangeul (Korean Phonics)</h3>
              <div className="program-duration">10 weeks · 1 class/week · 90 minutes · Max 4 students/class</div>
              <div className="program-schedule" style={{ margin: '1rem 0', padding: '0.75rem', background: '#f8f6f3', borderRadius: 8, fontSize: '0.9rem' }}>
                📅 <strong>Class Schedule</strong><br />
                🟢 K–1 Lev.1 · Wed · 2:30–4:00 PM<br />
                🟢 K–1 Lev.2 · Fri · 4:30–6:00 PM <em>or</em> Sat · 3:30–5:00 PM (choose one day)
              </div>
              <div className="program-cta" style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/assets/pdf/hangeul_english.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Course Description (English)</a>
                <a href="/assets/pdf/hangeul_korean.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>수업 안내 (한국어)</a>
              </div>
              <div style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600, color: '#4a3c28', fontSize: '0.95rem' }}>Spring 2026 Curriculum</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href="/assets/pdf/curriculum_hangeul_lev1.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Lev.1 (Wed)</a>
                <a href="/assets/pdf/curriculum_hangeul_lev2_fri.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Lev.2 (Fri)</a>
                <a href="/assets/pdf/curriculum_hangeul_lev2_sat.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Lev.2 (Sat)</a>
              </div>
            </div>

            <div className="program-card animate-in" data-category="creative" style={cardStyle('creative')}>
              <h3>Korean Book Club (Advanced)</h3>
              <div className="program-duration">10 weeks · 1 class/week · 90 minutes · Max 4 students/class</div>
              <div className="program-schedule" style={{ margin: '1rem 0', padding: '0.75rem', background: '#f8f6f3', borderRadius: 8, fontSize: '0.9rem' }}>
                📅 <strong>Class Schedule</strong><br />
                🟣 Gr. 3–6 · Fri · 6:30–8:00 PM<br />
                <em>(Students must already read and write in Korean fluently)</em>
              </div>
              <div className="program-cta" style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/assets/pdf/korean_bookclub_english.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Course Description (English)</a>
                <a href="/assets/pdf/korean_bookclub_korean.pdf" className="btn btn-primary" download style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>수업 안내 (한국어)</a>
              </div>
              <div style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600, color: '#4a3c28', fontSize: '0.95rem' }}>Spring 2026 Curriculum</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href="/assets/pdf/curriculum_korean_bookclub.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', padding: '0.6rem 0.8rem' }}>Korean Book Club (Fri)</a>
              </div>
            </div>

            <div className="program-card animate-in" data-category="summer" style={cardStyle('summer')}>
              <h3>Summer Camp</h3>
              <div className="program-schedule" style={{ margin: '1rem 0', padding: '0.75rem', background: '#f8f6f3', borderRadius: 8, fontSize: '0.9rem' }}>
                📅 <strong>Session Schedule</strong><br />
                🔵 Gr. 2–3 · June 22 – July 3<br />
                🟢 K–1 · July 6 – July 17<br />
                🟣 Gr. 4–5 · July 20 – July 31<br />
                🟣 Gr. 4–5 · August 3 – August 14
              </div>
              <div className="program-cta" style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/assets/pdf/summer_camp_info.pdf" className="btn btn-secondary" target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center' }}>Summer Camp Details</a>
                <Link href="/contact" className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>Contact Us</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
