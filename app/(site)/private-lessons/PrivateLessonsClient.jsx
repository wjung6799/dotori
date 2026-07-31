'use client';

import { useState } from 'react';
import Link from 'next/link';

// Private & Semi-Private Lessons page with an English/Korean toggle.

const T = {
  en: {
    heading: 'Private & Semi-Private Lessons',
    intro:
      'One-on-one and semi-private lessons, scheduled directly with the instructor. Any academic area, from reading and writing to math and test prep, with a lesson plan built around your child.',
    cta: 'Book a Free Diagnostic Assessment',
  },
  ko: {
    heading: '1:1 & 세미프라이빗 수업',
    intro:
      '강사와 직접 일정을 조율하는 1:1 및 세미프라이빗 수업입니다. 읽기·쓰기부터 수학·시험 대비까지 모든 학습 영역에서, 아이에게 맞춘 수업 계획으로 진행됩니다.',
    cta: '무료 진단평가 예약',
  },
};

export default function PrivateLessonsClient() {
  const [lang, setLang] = useState('en');
  const t = T[lang];

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
    .pl-toggle { display: flex; justify-content: center; gap: 0.4rem; margin-bottom: 1.5rem; }
    .pl-toggle button {
        border: 1px solid #d8cdbd; background: #fff; color: #6b5b47; font-weight: 600;
        font-size: 0.88rem; padding: 0.45rem 1.3rem; border-radius: 25px; cursor: pointer;
        transition: all 0.25s ease;
    }
    .pl-toggle button.on {
        background: linear-gradient(135deg, #8b7355, #a0856b); color: #fff; border-color: transparent;
    }
`,
        }}
      />

      <main lang={lang}>
        <div className="container">
          <div className="page-header">
            <h1>{t.heading}</h1>

            {/* Language toggle */}
            <div className="pl-toggle" role="group" aria-label="Language">
              <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? 'on' : undefined} onClick={() => setLang('en')}>
                English
              </button>
              <button type="button" aria-pressed={lang === 'ko'} className={lang === 'ko' ? 'on' : undefined} onClick={() => setLang('ko')}>
                한국어
              </button>
            </div>

            <p style={{ textAlign: 'left' }}>{t.intro}</p>
            <div style={{ marginTop: '1.5rem' }}>
              <Link href="/diagnostic" className="btn btn-primary" style={{ padding: '0.9rem 2.25rem', fontSize: '1.05rem', flex: 'none', display: 'inline-block' }}>
                {t.cta}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
