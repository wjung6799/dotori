'use client';

import { useState } from 'react';
import Link from 'next/link';

// English Literacy page: diagnostic-based placement into four levels, with an
// English/Korean toggle. All copy lives in the T object below (en/ko mirror
// each other) so the two languages stay in sync.

const LEVEL_COLORS = {
  sprout: '#d9a83c',
  sapling: '#9cb356',
  oak: '#b3622e',
  greatOak: '#8a352a',
  korean: '#7d9bc1',
  phonics: '#c98a3d',
  workshop: '#a58ec4',
  neutral: '#cfc6b8',
};

// Cell backgrounds for the placement table's level column.
const LEVEL_CELL = {
  sprout: { background: '#d9a83c', color: '#4a3c28' },
  sapling: { background: '#9cb356', color: '#3d4a1f' },
  oak: { background: '#b3622e', color: '#fff' },
  greatOak: { background: '#8a352a', color: '#fff' },
};

const T = {
  en: {
    heading: 'English Literacy',
    introParts: {
      before: 'Every new student begins with a ',
      link: 'complimentary diagnostic assessment',
      after:
        ' of reading and writing. Placement is based on demonstrated literacy rather than grade, and each student is assigned to one of four levels: ',
      levels: 'Sprout · Sapling · Oak · Great Oak',
      after2: '. Students who are not yet reading independently build decoding skills in ',
      phonics: 'Kinder Phonics',
      after3: ' before moving into the leveled program.',
    },
    cards: [
      {
        title: 'Kinder Phonics',
        tag: 'On-Ramp',
        body: 'Focused instruction in phonics and decoding that builds the foundation for independent reading. Students move into Core Literacy once they can read on their own.',
        materials: 'Materials · Heggerty, UFLI, in-house',
        footer: 'Pre-reading stage · 80 min / week',
      },
      {
        title: 'Core Literacy',
        tag: 'Foundational Course',
        body: 'Vocabulary, reading, and writing taught and applied as one connected flow. Intensive comprehension strategies and structured genre writing build strong, durable literacy.',
        materials: 'Materials · In-house curriculum, Spectrum Reading/Writing',
        footer: 'Placed by reading level · 80 min / week',
      },
      {
        title: 'Book Club',
        tag: 'Reading & Discussion',
        body: 'Students read full books, building vocabulary in context alongside literary thinking and writing. Rotating roles build responsibility, leadership, and the ability to express ideas clearly.',
        materials: 'Materials · In-house Book Club curriculum',
        footer: 'Placed by reading level · 80 min / week',
      },
      {
        title: "Writer's Workshop",
        tag: 'Publishing Project',
        body: 'Over three terms (36 weeks), students write their own book and publish it as a formal title with an ISBN, credited as the author.',
        materials: '',
        note: 'Oak level and above only',
        footer: '3-term course · 80 min / week',
      },
    ],
    tableTitle: 'Placement Levels',
    tableHead: ['Level', 'Grade', 'Reading level', 'Core Literacy focus', 'Book Club anchor titles', 'Writing goal'],
    levels: [
      {
        key: 'sprout',
        name: 'Sprout',
        grade: 'K–1',
        reading: '100–600L · F&P I–M',
        focus: 'Fluency, main idea & detail, sequence & basic cause–effect',
        books: 'Fly Guy · Mercy Watson · Frog and Toad',
        writing: 'Full sentences to a paragraph',
      },
      {
        key: 'sapling',
        name: 'Sapling',
        grade: '2–3',
        reading: '500–900L · F&P N–S',
        focus: 'Inference, text structure, finding evidence, morphology',
        books: "Charlotte's Web · Frindle · The Mouse and the Motorcycle",
        writing: 'Multi-paragraph, citing evidence',
      },
      {
        key: 'oak',
        name: 'Oak',
        grade: '4–5',
        reading: '800–1150L · F&P T–Y',
        focus: 'Theme, argument, tone, comparing texts',
        books: 'Wonder · Hatchet · Holes',
        writing: 'Thesis essay, addressing counterpoints',
      },
      {
        key: 'greatOak',
        name: 'Great Oak',
        grade: '6–8',
        reading: '1050L+ · F&P Z–Z+',
        focus: 'Evaluating evidence, rhetorical analysis, synthesis',
        books: 'Animal Farm · The Giver · Linked',
        writing: 'Sophisticated argument, analysis of literary devices',
      },
    ],
    scheduleTitle: 'Weekly Schedule',
    legendTitle: 'Levels',
    legend: [
      { key: 'sprout', label: 'Sprout · K–1' },
      { key: 'sapling', label: 'Sapling · Grades 2–3' },
      { key: 'oak', label: 'Oak · Grades 4–5' },
      { key: 'greatOak', label: 'Great Oak · Grades 6–8' },
    ],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    koreanClass: 'Korean Phonics (Hangeul) Lev.3',
    grades: { k1: 'K–1', g23: 'Gr. 2–3', g45: 'Gr. 4–5', g68: 'Gr. 6–8' },
    tutorNote: 'w/ Mrs. Jung',
  },
  ko: {
    heading: 'English Literacy',
    introParts: {
      before: '도토리스쿨의 모든 신규 학생은 ',
      link: '무료 진단평가',
      after:
        '로 시작합니다. 반은 학년이 아니라 실제 읽기·쓰기 실력을 기준으로 정하며, 진단 결과에 따라 네 단계(',
      levels: 'Sprout · Sapling · Oak · Great Oak',
      after2: ') 중 한 곳에 배정됩니다. 아직 스스로 읽기 어려운 학생은 ',
      phonics: 'Kinder Phonics',
      after3: '에서 기초 해독(decoding) 능력을 다진 뒤 정규 과정으로 올라갑니다.',
    },
    cards: [
      {
        title: 'Kinder Phonics',
        tag: '준비 과정',
        body: '파닉스와 디코딩을 집중적으로 지도해 스스로 읽을 수 있는 토대를 만듭니다. 혼자 읽기가 가능해지면 맞춤 문해력 수업으로 올라갑니다.',
        materials: '교재 · Heggerty · UFLI · 자체 제작',
        footer: '읽기 이전 단계 · 주 1회 80분',
      },
      {
        title: '맞춤 문해력 수업',
        tag: '기본 과정',
        body: '어휘·독해·작문을 하나의 흐름으로 엮어 배우고 적용합니다. 체계적인 독해 전략과 장르별 글쓰기 훈련으로 탄탄한 문해력을 키웁니다.',
        materials: '교재 · 자체 제작 · Spectrum Reading/Writing',
        footer: '읽기 레벨별 편성 · 주 1회 80분',
      },
      {
        title: 'Book Club',
        tag: '완독·토론 수업',
        body: '한 권의 책을 함께 읽으며 문맥 속 어휘, 문학적 사고, 글쓰기를 통합적으로 훈련합니다. 학생마다 역할을 맡아 책임감과 리더십을 기르고, 자기 생각을 조리 있게 표현하는 연습을 합니다.',
        materials: '교재 · 북클럽 전용 자체 제작',
        footer: '읽기 레벨별 편성 · 주 1회 80분',
      },
      {
        title: "Writer's Workshop",
        tag: '출판 프로젝트',
        body: '3학기(36주)에 걸쳐 자신의 책을 완성해 ISBN이 부여된 정식 도서로 출판합니다. 학생이 저자로 이름을 올립니다.',
        materials: '',
        note: 'Oak 단계 이상만 수강 가능',
        footer: '3학기 과정 · 주 1회 80분',
      },
    ],
    tableTitle: '단계별 편성 기준',
    tableHead: ['단계', '참고 학년', '읽기 수준', '맞춤 문해력 학습 초점', 'Book Club 대표 도서', '쓰기 목표'],
    levels: [
      {
        key: 'sprout',
        name: 'Sprout',
        grade: 'K–1',
        reading: '100–600L · F&P I–M',
        focus: '유창성, 중심생각과 세부, 순서·기초 인과',
        books: 'Fly Guy · Mercy Watson · Frog and Toad',
        writing: '완전한 문장에서 한 문단으로',
      },
      {
        key: 'sapling',
        name: 'Sapling',
        grade: '2–3',
        reading: '500–900L · F&P N–S',
        focus: '추론, 텍스트 구조, 근거 찾기, 형태소',
        books: "Charlotte's Web · Frindle · The Mouse and the Motorcycle",
        writing: '다문단 구성, 근거 인용',
      },
      {
        key: 'oak',
        name: 'Oak',
        grade: '4–5',
        reading: '800–1150L · F&P T–Y',
        focus: '주제, 논증, 어조, 텍스트 간 비교',
        books: 'Wonder · Hatchet · Holes',
        writing: '논지 에세이, 반론 인식',
      },
      {
        key: 'greatOak',
        name: 'Great Oak',
        grade: '6–8',
        reading: '1050L+ · F&P Z–Z+',
        focus: '근거 평가, 수사 분석, 여러 자료 종합',
        books: 'Animal Farm · The Giver · Linked',
        writing: '정교한 논증, 문학적 기법 분석',
      },
    ],
    scheduleTitle: '주간 시간표',
    legendTitle: '단계 안내',
    legend: [
      { key: 'sprout', label: 'Sprout 새싹 · K–1학년' },
      { key: 'sapling', label: 'Sapling 묘목 · 2–3학년' },
      { key: 'oak', label: 'Oak 참나무 · 4–5학년' },
      { key: 'greatOak', label: 'Great Oak 큰 참나무 · 6–8학년' },
    ],
    days: ['월', '화', '수', '목', '금', '토'],
    koreanClass: 'Korean Phonics (한글) Lev.3',
    grades: { k1: 'K–1', g23: '2–3학년', g45: '4–5학년', g68: '6–8학년' },
    tutorNote: 'Mrs. Jung 담당',
  },
};

// Weekly schedule data. Class names stay the same in both languages except the
// Korean class (t.koreanClass), grade badges (t.grades), and the tutor note
// (t.tutorNote). Index 0 = Monday.
const WEEK = [
  [
    { title: 'Core Literacy', level: 'Sprout', grade: 'k1', time: '4:30–5:50', lv: 'sprout' },
    { title: 'Core Literacy', level: 'Oak', grade: 'g45', time: '6:00–7:20', lv: 'oak' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    { title: 'Core Literacy', level: 'Sapling', grade: 'g23', time: '4:30–5:50', lv: 'sapling' },
    { title: 'Core Literacy', level: 'Great Oak', grade: 'g68', time: '6:00–7:20', lv: 'greatOak' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    { korean: true, grade: 'k1', time: '2:30–3:50', lv: 'korean' },
    { title: 'Kinder Phonics', time: '4:00–5:20', lv: 'phonics' },
    { title: "Writer's Workshop", time: '5:30–7:20', lv: 'workshop' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    { title: 'Book Club', level: 'Sapling', grade: 'g23', time: '4:30–5:50', lv: 'sapling' },
    { title: 'Book Club', level: 'Oak', grade: 'g45', time: '6:00–7:20', lv: 'oak' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    { title: 'Book Club', level: 'Sprout', grade: 'k1', time: '4:30–5:50', lv: 'sprout' },
    { title: 'Book Club', level: 'Great Oak', grade: 'g68', time: '6:00–7:20', lv: 'greatOak' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    {
      title: 'Semi-Private',
      tutor: true,
      times: ['9:00–10:30', '10:30–12:00', '1:00–2:30', '2:30–4:00', '4:00–5:30'],
      lv: 'neutral',
    },
  ],
];

export default function LiteracyClient() {
  const [lang, setLang] = useState('en');
  const t = T[lang];

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
    .lit-toggle { display: flex; justify-content: center; gap: 0.4rem; margin-bottom: 1.5rem; }
    .lit-toggle button {
        border: 1px solid #d8cdbd; background: #fff; color: #6b5b47; font-weight: 600;
        font-size: 0.88rem; padding: 0.45rem 1.3rem; border-radius: 25px; cursor: pointer;
        transition: all 0.25s ease;
    }
    .lit-toggle button.on {
        background: linear-gradient(135deg, #8b7355, #a0856b); color: #fff; border-color: transparent;
    }

    .lit-cards { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin: 2rem 0 3rem; }
    .lit-card {
        background: #fff; border-radius: 14px; padding: 1.5rem;
        border-top: 3px solid #8b7355; box-shadow: 0 8px 20px rgba(139,115,85,0.08);
        display: flex; flex-direction: column;
    }
    .lit-card h3 { color: #4a3c28; margin: 0 0 0.15rem; font-size: 1.15rem; }
    .lit-card .lit-tag { color: #b3622e; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 0.7rem; }
    .lit-card p { color: #6b5b47; font-size: 0.92rem; line-height: 1.55; margin: 0; flex: 1; }
    .lit-card .lit-meta { border-top: 1px solid #eee6da; margin-top: 0.9rem; padding-top: 0.6rem; font-size: 0.78rem; color: #a0906f; }
    .lit-card .lit-meta + .lit-meta { border-top: none; margin-top: 0.25rem; padding-top: 0; }
    .lit-card .lit-note { color: #b3622e; font-weight: 700; font-size: 0.82rem; }

    .lit-section-title { color: #4a3c28; font-size: 1.5rem; margin: 0 0 1rem; }

    .lit-table-wrap { overflow-x: auto; border-radius: 12px; box-shadow: 0 8px 20px rgba(139,115,85,0.08); margin-bottom: 3rem; }
    .lit-table { width: 100%; min-width: 780px; border-collapse: collapse; background: #fff; font-size: 0.9rem; }
    .lit-table th { background: #5d4a35; color: #fff; text-align: left; padding: 0.7rem 0.9rem; font-weight: 600; white-space: nowrap; }
    .lit-table td { padding: 0.75rem 0.9rem; border-bottom: 1px solid #f0e9df; color: #6b5b47; vertical-align: top; }
    .lit-table tr:last-child td { border-bottom: none; }
    .lit-table .lit-level { font-weight: 700; white-space: nowrap; }
    .lit-table .lit-books { font-weight: 600; color: #4a3c28; }

    .lit-legend { display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; align-items: center; margin-bottom: 1rem; font-size: 0.85rem; color: #6b5b47; }
    .lit-legend .lit-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 0.35rem; vertical-align: -1px; }
    .lit-legend strong { color: #4a3c28; }

    .lit-week-wrap { overflow-x: auto; padding-bottom: 0.5rem; }
    .lit-week { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; min-width: 860px; }
    .lit-day-head { background: #5d4a35; color: #fff; text-align: center; font-weight: 600; font-size: 0.88rem; padding: 0.55rem 0; border-radius: 10px 10px 0 0; }
    .lit-class {
        background: #fff; border-left: 4px solid #cfc6b8; border-radius: 8px;
        padding: 0.55rem 0.65rem; box-shadow: 0 3px 10px rgba(139,115,85,0.07);
    }
    .lit-class .lit-c-title { font-weight: 700; color: #4a3c28; font-size: 0.85rem; }
    .lit-class .lit-c-grade { color: #a08430; font-size: 0.72rem; font-weight: 700; white-space: nowrap; }
    .lit-class .lit-c-note { color: #a08430; font-size: 0.74rem; font-weight: 600; margin-top: 0.05rem; }
    .lit-class .lit-c-time { color: #6b5b47; font-size: 0.78rem; margin-top: 0.2rem; }
`,
        }}
      />

      <main lang={lang}>
        <div className="container">
          <div className="page-header">
            <h1>{t.heading}</h1>

            {/* Language toggle */}
            <div className="lit-toggle" role="group" aria-label="Language">
              <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? 'on' : undefined} onClick={() => setLang('en')}>
                English
              </button>
              <button type="button" aria-pressed={lang === 'ko'} className={lang === 'ko' ? 'on' : undefined} onClick={() => setLang('ko')}>
                한국어
              </button>
            </div>

            <p style={{ textAlign: 'left', lineHeight: 1.7 }}>
              {t.introParts.before}
              <Link href="/diagnostic" style={{ color: '#8b7355', fontWeight: 700 }}>
                {t.introParts.link}
              </Link>
              {t.introParts.after}
              <strong>{t.introParts.levels}</strong>
              {t.introParts.after2}
              <strong>{t.introParts.phonics}</strong>
              {t.introParts.after3}
            </p>
          </div>

          {/* Course cards */}
          <div className="lit-cards">
            {t.cards.map((c) => (
              <div className="lit-card" key={c.title}>
                <h3>{c.title}</h3>
                <div className="lit-tag">{c.tag}</div>
                <p>{c.body}</p>
                {c.note ? <div className="lit-meta lit-note">{c.note}</div> : null}
                {c.materials ? <div className="lit-meta">{c.materials}</div> : null}
                <div className="lit-meta">{c.footer}</div>
              </div>
            ))}
          </div>

          {/* Placement levels table */}
          <h2 className="lit-section-title">{t.tableTitle}</h2>
          <div className="lit-table-wrap">
            <table className="lit-table">
              <thead>
                <tr>
                  {t.tableHead.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.levels.map((l) => (
                  <tr key={l.key}>
                    <td className="lit-level" style={LEVEL_CELL[l.key]}>{l.name}</td>
                    <td style={{ fontWeight: 700, color: '#4a3c28', whiteSpace: 'nowrap' }}>{l.grade}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.reading}</td>
                    <td>{l.focus}</td>
                    <td className="lit-books">{l.books}</td>
                    <td>{l.writing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Weekly schedule */}
          <h2 className="lit-section-title">{t.scheduleTitle}</h2>
          <div className="lit-legend">
            <strong>{t.legendTitle}</strong>
            {t.legend.map((l) => (
              <span key={l.key}>
                <span className="lit-swatch" style={{ background: LEVEL_COLORS[l.key] }} />
                {l.label}
              </span>
            ))}
          </div>
          <div className="lit-week-wrap">
            <div className="lit-week">
              {t.days.map((d, i) => (
                <div className="lit-day-head" key={d} style={{ gridColumn: i + 1, gridRow: 1 }}>{d}</div>
              ))}
              {/* Blocks are placed on an explicit grid (column = day, row = slot)
                  so the nth class of each day lines up across the week. */}
              {WEEK.map((classes, i) =>
                classes.map((c, j) => (
                  <div
                    className="lit-class"
                    key={`${i}-${j}`}
                    style={{ gridColumn: i + 1, gridRow: j + 2, borderLeftColor: LEVEL_COLORS[c.lv] }}
                  >
                    <div className="lit-c-title">
                      {c.korean ? t.koreanClass : c.title}
                      {c.level ? ` (${c.level})` : ''}
                      {c.grade ? <span className="lit-c-grade"> {t.grades[c.grade]}</span> : null}
                    </div>
                    {c.tutor ? <div className="lit-c-note">{t.tutorNote}</div> : null}
                    {c.times ? (
                      c.times.map((time) => (
                        <div className="lit-c-time" key={time}>{time}</div>
                      ))
                    ) : (
                      <div className="lit-c-time">{c.time}</div>
                    )}
                  </div>
                )),
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
