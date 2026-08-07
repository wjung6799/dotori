'use client';

import { useState } from 'react';

// Private & Semi-Private Lessons page with an English/Korean toggle.
// 1:1 and Semi-Private are described separately: semi-private is one teacher
// with two students, 90-minute sessions as standard.

const T = {
  en: {
    heading: 'Private & Semi-Private Lessons',
    intro:
      'Lessons scheduled directly with the instructor, in any academic area, with a plan built around your child.',
    cards: [
      {
        title: '1:1 Private',
        tag: 'One teacher · one student',
        body: 'Fully personalized instruction in any academic area, from reading and writing to math and test prep. Sessions are arranged directly with the instructor.',
        note: 'Availability is very limited.',
      },
      {
        title: 'Semi-Private',
        tag: 'One teacher · two students',
        body: 'A small pairing that keeps the teacher close enough to directly support what each student needs. Sessions run 90 minutes as standard.',
        fitTitle: 'A good fit for:',
        fit: [
          'School coursework and homework help',
          'Focused support where a student needs it most',
          'Writing projects',
          'Students who can’t join regular Dotori classes because of schedule conflicts',
        ],
      },
    ],
  },
  ko: {
    heading: '1:1 & 세미프라이빗 수업',
    intro: '강사와 직접 일정을 조율하는 수업입니다. 모든 학습 영역에서, 아이에게 맞춘 계획으로 진행됩니다.',
    cards: [
      {
        title: '1:1 Private',
        tag: '교사 1 : 학생 1',
        body: '읽기·쓰기부터 수학·시험 대비까지 모든 학습 영역에서 완전히 맞춤화된 수업입니다. 수업 일정은 강사와 직접 조율합니다.',
        note: '수업 가능 시간대가 매우 제한적입니다.',
      },
      {
        title: 'Semi-Private',
        tag: '교사 1 : 학생 2',
        body: '교사가 두 학생 곁에서 각자 필요한 부분을 직접적으로 도울 수 있는 소규모 수업입니다. 기본 1시간 30분으로 진행됩니다.',
        fitTitle: '이런 경우에 잘 맞아요:',
        fit: [
          '학교 과정·숙제 도움',
          '집중이 필요한 부분 서포트',
          '글쓰기 프로젝트',
          '스케줄이 맞지 않아 도토리 정규 수업을 듣기 어려운 학생',
        ],
      },
    ],
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

    .pl-cards { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); margin: 2rem 0 3rem; }
    .pl-card {
        background: #fff; border-radius: 14px; padding: 1.75rem;
        border-top: 3px solid #8b7355; box-shadow: 0 8px 20px rgba(139,115,85,0.08);
    }
    .pl-card h2 { color: #4a3c28; margin: 0 0 0.15rem; font-size: 1.25rem; }
    .pl-card .pl-tag { color: #b3622e; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.8rem; }
    .pl-card p { color: #6b5b47; font-size: 0.95rem; line-height: 1.6; margin: 0; }
    .pl-card .pl-note { color: #b3622e; font-weight: 700; font-size: 0.88rem; margin-top: 0.8rem; }
    .pl-card .pl-fit-title { color: #4a3c28; font-weight: 700; font-size: 0.9rem; margin: 1rem 0 0.4rem; }
    .pl-card ul { margin: 0; padding-left: 1.2rem; color: #6b5b47; font-size: 0.92rem; line-height: 1.7; }
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
          </div>

          <div className="pl-cards">
            {t.cards.map((c) => (
              <div className="pl-card" key={c.title}>
                <h2>{c.title}</h2>
                <div className="pl-tag">{c.tag}</div>
                <p>{c.body}</p>
                {c.note ? <div className="pl-note">{c.note}</div> : null}
                {c.fit ? (
                  <>
                    <div className="pl-fit-title">{c.fitTitle}</div>
                    <ul>
                      {c.fit.map((f) => (
                        <li key={f.slice(0, 20)}>{f}</li>
                      ))}
                    </ul>
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
