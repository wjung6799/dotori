'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// English Literacy page: diagnostic-based placement into four levels, with an
// English/Korean toggle. All copy lives in the T object below (en/ko mirror
// each other) so the two languages stay in sync.

// Level colors follow the level icons: acorn orange, then greens deepening
// into oak brown as students grow.
const LEVEL_COLORS = {
  acorn: '#E89B3C',
  sprout: '#8FAF6A',
  sapling: '#55743F',
  oak: '#5F4630',
  korean: '#7d9bc1',
  phonics: '#c98a3d',
  workshop: '#a58ec4',
  neutral: '#cfc6b8',
};

// Cell backgrounds for the placement table's level column.
const LEVEL_CELL = {
  acorn: { background: '#E89B3C', color: '#4a3c28' },
  sprout: { background: '#8FAF6A', color: '#3d4a1f' },
  sapling: { background: '#55743F', color: '#fff' },
  oak: { background: '#5F4630', color: '#fff' },
};

/* ── Level icons (acorn growing into an oak) ── */
const AcornIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <g transform="translate(13.40,9.75) scale(1.550)">
      <path d="M12 2.6 C12 1 12.7 0.4 13.2 0.2" stroke="#5F4630" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M0.8 8.2 C0.8 4.4 5.8 1.9 12 1.9 C18.2 1.9 23.2 4.4 23.2 8.2 C23.2 9.9 22 10.8 20.4 10.8 L3.6 10.8 C2 10.8 0.8 9.9 0.8 8.2 Z" fill="#7A5C3E" />
      <path d="M3 11.4 L21 11.4 C21 22.4 17.4 29.4 12 29.4 C6.6 29.4 3 22.4 3 11.4 Z" fill="#E89B3C" />
      <path d="M7.6 14.6 C6.8 19 7.1 23.2 8.6 26.4" stroke="#F7C784" strokeWidth="1.7" fill="none" strokeLinecap="round" opacity="0.8" />
    </g>
  </svg>
);

const SproutIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <path d="M32 44 C32 34 32 26 32 17" stroke="#55743F" strokeWidth="3" fill="none" strokeLinecap="round" />
    <g transform="translate(31,25) rotate(202)">
      <path d="M0 0 C5.1 -6.4 12.24 -6.4 17 0 C12.24 6.4 5.1 6.4 0 0 Z" fill="#8FAF6A" />
    </g>
    <g transform="translate(33,19) rotate(-22)">
      <path d="M0 0 C5.7 -7.0 13.68 -7.0 19 0 C13.68 7.0 5.7 7.0 0 0 Z" fill="#55743F" />
    </g>
    <g transform="translate(19.40,31.25) scale(1.050)">
      <path d="M12 2.6 C12 1 12.7 0.4 13.2 0.2" stroke="#5F4630" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M0.8 8.2 C0.8 4.4 5.8 1.9 12 1.9 C18.2 1.9 23.2 4.4 23.2 8.2 C23.2 9.9 22 10.8 20.4 10.8 L3.6 10.8 C2 10.8 0.8 9.9 0.8 8.2 Z" fill="#7A5C3E" />
      <path d="M3 11.4 L21 11.4 C21 22.4 17.4 29.4 12 29.4 C6.6 29.4 3 22.4 3 11.4 Z" fill="#E89B3C" />
      <path d="M7.6 14.6 C6.8 19 7.1 23.2 8.6 26.4" stroke="#F7C784" strokeWidth="1.7" fill="none" strokeLinecap="round" opacity="0.8" />
    </g>
  </svg>
);

const SaplingIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <path d="M30.6 57 L30.6 30 L33.4 30 L33.4 57 Z" fill="#7A5C3E" />
    <path d="M32 40 L23.5 33.5" stroke="#7A5C3E" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M32 36 L40.5 30" stroke="#7A5C3E" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="22.5" cy="28" r="8.4" fill="#55743F" />
    <circle cx="41.5" cy="28" r="8.4" fill="#55743F" />
    <circle cx="32" cy="15.5" r="8.0" fill="#55743F" />
    <circle cx="32" cy="22" r="10.8" fill="#8FAF6A" />
    <circle cx="24.5" cy="24" r="7.6" fill="#8FAF6A" />
    <circle cx="39.5" cy="24" r="7.6" fill="#8FAF6A" />
  </svg>
);

const OakIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <path d="M27.2 58 C28.6 50 29.2 43 29.2 33 L34.8 33 C34.8 43 35.4 50 36.8 58 Z" fill="#7A5C3E" />
    <path d="M32 40 L21 32" stroke="#7A5C3E" strokeWidth="3" strokeLinecap="round" />
    <path d="M32 37 L43.5 30" stroke="#7A5C3E" strokeWidth="3" strokeLinecap="round" />
    <circle cx="16.5" cy="27" r="9.4" fill="#55743F" />
    <circle cx="47.5" cy="27" r="9.4" fill="#55743F" />
    <circle cx="32" cy="12.5" r="9.6" fill="#55743F" />
    <circle cx="22" cy="32" r="9.0" fill="#55743F" />
    <circle cx="42" cy="32" r="9.0" fill="#55743F" />
    <circle cx="24" cy="22" r="11.0" fill="#8FAF6A" />
    <circle cx="40" cy="22" r="11.0" fill="#8FAF6A" />
    <circle cx="32" cy="27" r="12.2" fill="#8FAF6A" />
    <circle cx="32" cy="16" r="8.6" fill="#8FAF6A" />
    <g transform="translate(15.70,32.50) scale(0.400)">
      <path d="M12 2.6 C12 1 12.7 0.4 13.2 0.2" stroke="#5F4630" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M0.8 8.2 C0.8 4.4 5.8 1.9 12 1.9 C18.2 1.9 23.2 4.4 23.2 8.2 C23.2 9.9 22 10.8 20.4 10.8 L3.6 10.8 C2 10.8 0.8 9.9 0.8 8.2 Z" fill="#7A5C3E" />
      <path d="M3 11.4 L21 11.4 C21 22.4 17.4 29.4 12 29.4 C6.6 29.4 3 22.4 3 11.4 Z" fill="#E89B3C" />
    </g>
    <g transform="translate(38.70,33.50) scale(0.400)">
      <path d="M12 2.6 C12 1 12.7 0.4 13.2 0.2" stroke="#5F4630" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M0.8 8.2 C0.8 4.4 5.8 1.9 12 1.9 C18.2 1.9 23.2 4.4 23.2 8.2 C23.2 9.9 22 10.8 20.4 10.8 L3.6 10.8 C2 10.8 0.8 9.9 0.8 8.2 Z" fill="#7A5C3E" />
      <path d="M3 11.4 L21 11.4 C21 22.4 17.4 29.4 12 29.4 C6.6 29.4 3 22.4 3 11.4 Z" fill="#E89B3C" />
    </g>
  </svg>
);

const LEVEL_ICONS = { acorn: AcornIcon, sprout: SproutIcon, sapling: SaplingIcon, oak: OakIcon };

const T = {
  en: {
    heading: 'English Literacy',
    introParts: {
      before: 'Every new student begins with a ',
      link: 'placement assessment',
      after:
        ' of reading and writing. Placement is based on demonstrated literacy rather than grade, and each student is assigned to one of four levels: ',
      levels: 'Acorn · Sprout · Sapling · Oak',
      after2: '. Students who are not yet reading independently build decoding skills in ',
      phonics: 'K–1 Phonics',
      after3: ' before moving into the leveled program.',
    },
    cards: [
      {
        title: 'K–1 Phonics',
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
        body: 'Over three terms (36 weeks), students complete a book and publish it as a formal title with an ISBN, credited as a co-author.',
        materials: '',
        note: 'Sapling level and above only',
        footer: '3-term course · 110 min / week',
      },
    ],
    tableTitle: 'Placement Levels',
    tableHead: ['Level', 'Grade', 'Reading level', 'Core Literacy focus', 'Book Club anchor titles', 'Writing goal'],
    levels: [
      {
        key: 'acorn',
        name: 'Acorn',
        grade: 'K–1',
        reading: '100–600L · F&P I–M',
        focus: 'Fluency, main idea & detail, sequence & basic cause–effect',
        books: 'Fly Guy · Mercy Watson · Frog and Toad',
        writing: 'Full sentences to a paragraph',
      },
      {
        key: 'sprout',
        name: 'Sprout',
        grade: '2–3',
        reading: '500–900L · F&P N–S',
        focus: 'Inference, text structure, finding evidence, morphology',
        books: "Charlotte's Web · Frindle · The Mouse and the Motorcycle",
        writing: 'Multi-paragraph, citing evidence',
      },
      {
        key: 'sapling',
        name: 'Sapling',
        grade: '4–5',
        reading: '800–1150L · F&P T–Y',
        focus: 'Theme, argument, tone, comparing texts',
        books: 'Wonder · Hatchet · Holes',
        writing: 'Thesis essay, addressing counterpoints',
      },
      {
        key: 'oak',
        name: 'Oak',
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
      { key: 'acorn', label: 'Acorn · K–1' },
      { key: 'sprout', label: 'Sprout · Grades 2–3' },
      { key: 'sapling', label: 'Sapling · Grades 4–5' },
      { key: 'oak', label: 'Oak · Grades 6–8' },
    ],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    koreanClass: 'Korean Phonics (Hangeul) Lev.3',
    grades: { k1: 'K–1', g23: 'Gr. 2–3', g45: 'Gr. 4–5', g68: 'Gr. 6–8' },
    tutorNote: 'w/ Mrs. Jung',
    seatsLeft: (n) => `${n} spot${n === 1 ? '' : 's'} left`,
    seatsFull: 'Full',
  },
  ko: {
    heading: 'English Literacy',
    introParts: {
      before: '도토리스쿨의 모든 신규 학생은 ',
      link: '배치 평가',
      after:
        '로 시작합니다. 반은 학년이 아니라 실제 읽기·쓰기 실력을 기준으로 정하며, 평가 결과에 따라 네 단계(',
      levels: 'Acorn · Sprout · Sapling · Oak',
      after2: ') 중 한 곳에 배정됩니다. 아직 스스로 읽기 어려운 학생은 ',
      phonics: 'K–1 Phonics',
      after3: '에서 기초 해독(decoding) 능력을 다진 뒤 정규 과정으로 올라갑니다.',
    },
    cards: [
      {
        title: 'K–1 Phonics',
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
        title: '북클럽',
        tag: '완독·토론 수업',
        body: '한 권의 책을 함께 읽으며 문맥 속 어휘, 문학적 사고, 글쓰기를 통합적으로 훈련합니다. 학생마다 역할을 맡아 책임감과 리더십을 기르고, 자기 생각을 조리 있게 표현하는 연습을 합니다.',
        materials: '교재 · 북클럽 전용 자체 제작',
        footer: '읽기 레벨별 편성 · 주 1회 80분',
      },
      {
        title: '출판 워크샵',
        tag: '출판 프로젝트',
        body: '3학기(36주)에 걸쳐 책을 완성해 ISBN이 부여된 정식 도서로 출판합니다. 학생이 공동저자로 이름을 올립니다.',
        materials: '',
        note: 'Sapling 단계 이상만 수강 가능',
        footer: '3학기 과정 · 주 1회 110분',
      },
    ],
    tableTitle: '단계별 편성 기준',
    tableHead: ['단계', '참고 학년', '읽기 수준', '맞춤 문해력 학습 초점', '북클럽 대표 도서', '쓰기 목표'],
    levels: [
      {
        key: 'acorn',
        name: 'Acorn',
        grade: 'K–1',
        reading: '100–600L · F&P I–M',
        focus: '유창성, 중심생각과 세부, 순서·기초 인과',
        books: 'Fly Guy · Mercy Watson · Frog and Toad',
        writing: '완전한 문장에서 한 문단으로',
      },
      {
        key: 'sprout',
        name: 'Sprout',
        grade: '2–3',
        reading: '500–900L · F&P N–S',
        focus: '추론, 텍스트 구조, 근거 찾기, 형태소',
        books: "Charlotte's Web · Frindle · The Mouse and the Motorcycle",
        writing: '다문단 구성, 근거 인용',
      },
      {
        key: 'sapling',
        name: 'Sapling',
        grade: '4–5',
        reading: '800–1150L · F&P T–Y',
        focus: '주제, 논증, 어조, 텍스트 간 비교',
        books: 'Wonder · Hatchet · Holes',
        writing: '논지 에세이, 반론 인식',
      },
      {
        key: 'oak',
        name: 'Oak',
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
      { key: 'acorn', label: 'Acorn 도토리 · K–1학년' },
      { key: 'sprout', label: 'Sprout 새싹 · 2–3학년' },
      { key: 'sapling', label: 'Sapling 묘목 · 4–5학년' },
      { key: 'oak', label: 'Oak 참나무 · 6–8학년' },
    ],
    days: ['월', '화', '수', '목', '금', '토'],
    koreanClass: 'Korean Phonics (한글) Lev.3',
    grades: { k1: 'K–1', g23: '2–3학년', g45: '4–5학년', g68: '6–8학년' },
    tutorNote: 'Mrs. Jung 담당',
    seatsLeft: (n) => `${n}자리 남음`,
    seatsFull: '마감',
  },
};

// Weekly schedule data. Class names stay the same in both languages except the
// Korean class (t.koreanClass), grade badges (t.grades), and the tutor note
// (t.tutorNote). Index 0 = Monday.
const WEEK = [
  [
    { title: 'Core Literacy', level: 'Acorn', grade: 'k1', time: '4:30–5:50', lv: 'acorn', classKey: 'mon-core-acorn' },
    { title: 'Book Club', level: 'Sapling', grade: 'g45', time: '6:00–7:20', lv: 'sapling', classKey: 'mon-book-sapling' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    { title: 'Core Literacy', level: 'Sprout', grade: 'g23', time: '4:30–5:50', lv: 'sprout', classKey: 'tue-core-sprout' },
    { title: 'Core Literacy', level: 'Sapling', grade: 'g45', time: '6:00–7:20', lv: 'sapling', classKey: 'tue-core-sapling' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    { korean: true, grade: 'k1', time: '2:30–3:50', lv: 'korean', classKey: 'wed-korean-lev3' },
    { title: 'K–1 Phonics', time: '4:00–5:20', lv: 'phonics', classKey: 'wed-kinder-phonics' },
    { title: "Writer's Workshop", time: '5:30–7:20', lv: 'workshop', classKey: 'wed-writers-workshop' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    { title: 'Book Club', level: 'Sprout', grade: 'g23', time: '4:30–5:50', lv: 'sprout', classKey: 'thu-book-sprout' },
    { title: 'Core Literacy', level: 'Oak', grade: 'g68', time: '6:00–7:20', lv: 'oak', classKey: 'thu-core-oak' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    { title: 'Book Club', level: 'Acorn', grade: 'k1', time: '4:30–5:50', lv: 'acorn', classKey: 'fri-book-acorn' },
    { title: 'Book Club', level: 'Oak', grade: 'g68', time: '6:00–7:20', lv: 'oak', classKey: 'fri-book-oak' },
    { title: '1:1 Private', tutor: true, time: '7:30–8:30', lv: 'neutral' },
  ],
  [
    {
      title: 'Semi-Private Lessons',
      tutor: true,
      times: ['9:00–10:30', '10:30–12:00', '1:00–2:30', '2:30–4:00', '4:00–5:30'],
      lv: 'neutral',
    },
  ],
];

export default function LiteracyClient() {
  const [lang, setLang] = useState('en');
  // Live enrolled/capacity per schedule slot, from Class docs linked by
  // scheduleKey (updates automatically as enrollments are added).
  const [seats, setSeats] = useState({});
  const t = T[lang];

  useEffect(() => {
    fetch('/api/classes/literacy-seats')
      .then((r) => r.json())
      .then((d) => setSeats(d.seats || {}))
      .catch(() => {});
  }, []);

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
    .lit-class .lit-c-seats { color: #1e7a40; font-size: 0.74rem; font-weight: 700; margin-top: 0.25rem; }
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
              <Link href="/placement-test" style={{ color: '#8b7355', fontWeight: 700 }}>
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
            {t.legend.map((l) => {
              const Icon = LEVEL_ICONS[l.key];
              return (
                <span key={l.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Icon size={20} />
                  {l.label}
                </span>
              );
            })}
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
                    {c.classKey && seats[c.classKey] ? (
                      <div
                        className="lit-c-seats"
                        style={seats[c.classKey].enrolled >= seats[c.classKey].capacity ? { color: '#a3261a' } : undefined}
                      >
                        {seats[c.classKey].enrolled >= seats[c.classKey].capacity
                          ? t.seatsFull
                          : t.seatsLeft(seats[c.classKey].capacity - seats[c.classKey].enrolled)}
                      </div>
                    ) : null}
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
