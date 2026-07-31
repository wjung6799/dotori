'use client';

import { useState } from 'react';

// K-1 Hangeul page with an English/Korean toggle. The course description used
// to live in PDF files (hangeul_english.pdf / hangeul_korean.pdf); it is now
// page content, kept in the T object below (en/ko mirror each other).

const T = {
  en: {
    heading: 'K–1 Hangeul (Korean Phonics)',
    intro: [
      'Dotori K–1 Korean is a structured foundational literacy program designed for children growing up in multilingual environments. Classes meet for 80 minutes and are conducted primarily in Korean. English is used strategically when needed to support comprehension and ensure a smooth learning transition.',
      'The program is organized into three progressive levels, beginning with basic consonants and vowels and advancing to final consonants and complex vowel combinations. Using a carefully designed, structured curriculum, we support students who need to strengthen their foundational skills.',
      'Our goal is for students to move beyond simply recognizing Hangeul. We guide them to understand sound patterns, build accurate reading skills, and develop the confidence to read and write independently.',
    ],
    levelsTitle: 'Levels',
    runningBadge: 'Currently running',
    levels: [
      {
        name: 'Level 1',
        body: 'Foundational consonants and vowels, letter–sound correspondence, syllable blending, and correct stroke order and letter formation.',
      },
      {
        name: 'Level 2',
        body: 'Double consonants and final consonants, improved reading accuracy and fluency, sentence-level reading and basic writing.',
      },
      {
        name: 'Level 3',
        body: 'Complex vowels, short passage reading, and expressing ideas in simple written sentences.',
        running: true,
      },
    ],
    scheduleTitle: 'Class Schedule',
    scheduleLine: 'Level 3 · Wednesday · 2:30–3:50 PM',
    scheduleNote: 'Small-group class · K–1',
    recommendTitle: 'Recommended for students who:',
    recommend: [
      'have had exposure to Korean but lack strong reading and writing foundations',
      'need systematic phonics instruction',
      'want to build accurate pronunciation and proper writing habits',
      'have lost interest in Korean due to traditional, drill-focused classroom experiences',
    ],
  },
  ko: {
    heading: '도토리스쿨 K–1 한글',
    intro: [
      '도토리스쿨 K–1 한글은 다중언어 환경에서 자라는 어린이들을 위한 체계적인 기초 한글 문해력 수업입니다. 회차당 80분으로 운영되며, 수업은 한국어 사용을 원칙으로 하되 학생의 이해도와 적응 수준에 따라 필요한 경우 영어를 보조적으로 활용합니다.',
      '본 과정은 총 3단계로 구성되어 있으며, 기초 자모 학습에서 시작하여 받침과 이중모음 확장까지 단계적으로 연결됩니다. 직접 개발한 맞춤형 교재를 활용해 한글을 처음 배우는 아이부터 기초를 다시 다지고 싶은 아이까지 수준에 맞게 지도합니다. 정확한 음가 이해와 바른 쓰기 습관을 기초부터 탄탄히 다지며, 이후 읽기와 독해 학습으로 자연스럽게 확장될 수 있도록 설계되어 있습니다.',
      '도토리스쿨 한글 수업은 아이가 “한글을 아는 것”을 넘어, 모국어와 연계하여 생각할 수 있고, “스스로 읽고 쓸 수 있는 언어로 체화하는 것”을 궁극적인 목표로 합니다.',
    ],
    levelsTitle: '단계 안내',
    runningBadge: '현재 운영 중',
    levels: [
      {
        name: 'Level 1',
        body: '기본 모음(ㅏ–ㅣ)과 자음(ㄱ–ㅎ)을 학습합니다. 영어 음가와 연결하여 각 소리를 명확히 구분하도록 돕고, 글자의 형태와 소리를 동시에 익히며 간단한 단어 조합 읽기, 정확한 필순과 바른 쓰기 습관을 형성하도록 지도합니다.',
      },
      {
        name: 'Level 2',
        body: '쌍자음과 받침을 학습하며 읽기 정확성과 유창성을 높입니다. 받침 소리의 변화를 이해하고, 음절 구조에 대한 이해를 확장합니다. 받침이 있는 단어 읽기를 시작하며, 소리의 길이와 강세 구분, 문장 단위 읽기, 본격적인 받아쓰기 및 간단한 문장 쓰기를 학습합니다.',
      },
      {
        name: 'Level 3',
        body: '다양한 이중모음을 학습하며 보다 복합적인 단어와 문장을 읽고 쓸 수 있도록 지도합니다. 이중모음 음가를 정확히 구분하고 문장 읽기 유창성 향상, 짧은 문단 읽기, 생각을 간단한 문장으로 표현하는 과정을 학습합니다.',
        running: true,
      },
    ],
    scheduleTitle: '수업 시간',
    scheduleLine: 'Level 3 · 수요일 · 2:30–3:50',
    scheduleNote: '소그룹 수업 · K–1',
    recommendTitle: '이런 학생들에게 추천합니다:',
    recommend: [
      '한국어 노출은 있었지만 읽기와 쓰기의 기초가 약한 학생',
      '한글학교를 다님에도 불구하고 체계적인 음가 이해가 부족한 학생',
      '정확한 발음과 바른 한글 쓰기 습관을 기초부터 다지고 싶은 학생',
      '반복 쓰기 위주의 학습에 한글에 대한 흥미를 잃은 학생',
    ],
  },
};

export default function KoreanClient() {
  const [lang, setLang] = useState('en');
  const t = T[lang];

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
    .kr-toggle { display: flex; justify-content: center; gap: 0.4rem; margin-bottom: 1.5rem; }
    .kr-toggle button {
        border: 1px solid #d8cdbd; background: #fff; color: #6b5b47; font-weight: 600;
        font-size: 0.88rem; padding: 0.45rem 1.3rem; border-radius: 25px; cursor: pointer;
        transition: all 0.25s ease;
    }
    .kr-toggle button.on {
        background: linear-gradient(135deg, #8b7355, #a0856b); color: #fff; border-color: transparent;
    }

    .kr-section-title { color: #4a3c28; font-size: 1.5rem; margin: 2.5rem 0 1rem; }

    .kr-levels { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .kr-level {
        background: #fff; border-radius: 14px; padding: 1.5rem;
        border-top: 3px solid #8b7355; box-shadow: 0 8px 20px rgba(139,115,85,0.08);
    }
    .kr-level h3 { color: #b3622e; margin: 0 0 0.6rem; font-size: 1.05rem; }
    .kr-level p { color: #6b5b47; font-size: 0.92rem; line-height: 1.6; margin: 0; }
    .kr-level .kr-badge {
        display: inline-block; background: #9cb356; color: #fff; font-size: 0.7rem; font-weight: 700;
        letter-spacing: 0.05em; text-transform: uppercase; border-radius: 25px;
        padding: 0.2rem 0.7rem; margin-left: 0.5rem; vertical-align: 2px;
    }

    .kr-schedule {
        background: #fff; border-left: 4px solid #7d9bc1; border-radius: 10px;
        padding: 1.1rem 1.4rem; box-shadow: 0 3px 10px rgba(139,115,85,0.07);
        max-width: 480px;
    }
    .kr-schedule .kr-s-line { font-weight: 700; color: #4a3c28; font-size: 1rem; }
    .kr-schedule .kr-s-note { color: #8b7355; font-size: 0.85rem; margin-top: 0.25rem; }

    .kr-recommend {
        background: #fbf6e9; border: 1px solid #ecd9a8; border-radius: 12px;
        padding: 1.4rem 1.75rem; margin: 2.5rem 0 3rem;
    }
    .kr-recommend h3 { color: #4a3c28; font-size: 1.05rem; margin: 0 0 0.7rem; }
    .kr-recommend ul { margin: 0; padding-left: 1.2rem; color: #6b5b47; line-height: 1.7; }
`,
        }}
      />

      <main lang={lang}>
        <div className="container">
          <div className="page-header">
            <h1>{t.heading}</h1>

            {/* Language toggle */}
            <div className="kr-toggle" role="group" aria-label="Language">
              <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? 'on' : undefined} onClick={() => setLang('en')}>
                English
              </button>
              <button type="button" aria-pressed={lang === 'ko'} className={lang === 'ko' ? 'on' : undefined} onClick={() => setLang('ko')}>
                한국어
              </button>
            </div>

            {t.intro.map((p) => (
              <p key={p.slice(0, 20)} style={{ textAlign: 'left', lineHeight: 1.7, marginBottom: '1rem' }}>
                {p}
              </p>
            ))}
          </div>

          {/* Levels */}
          <h2 className="kr-section-title">{t.levelsTitle}</h2>
          <div className="kr-levels">
            {t.levels.map((l) => (
              <div className="kr-level" key={l.name}>
                <h3>
                  {l.name}
                  {l.running ? <span className="kr-badge">{t.runningBadge}</span> : null}
                </h3>
                <p>{l.body}</p>
              </div>
            ))}
          </div>

          {/* Class schedule */}
          <h2 className="kr-section-title">{t.scheduleTitle}</h2>
          <div className="kr-schedule">
            <div className="kr-s-line">📅 {t.scheduleLine}</div>
            <div className="kr-s-note">{t.scheduleNote}</div>
          </div>

          {/* Recommended for */}
          <div className="kr-recommend">
            <h3>{t.recommendTitle}</h3>
            <ul>
              {t.recommend.map((r) => (
                <li key={r.slice(0, 20)}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
