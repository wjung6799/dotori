'use client';

import { useState } from 'react';
import Link from 'next/link';

// Math & Test Prep page with an English/Korean toggle. All copy lives in the
// T object below (en/ko mirror each other), same pattern as the Literacy and
// Korean pages.

const T = {
  en: {
    heading: 'Math & Test Prep',
    intro:
      'Better grades and higher scores, built on real understanding. Personalized tutoring in small groups, every student on their own plan, with the same instructor every session.',
    cta: 'Book a Free Diagnostic Assessment',
    notWorksheetHeading: 'Not a worksheet center',
    notWorksheetBody:
      'We don’t hand out packets and walk away. Every student follows their own curriculum, with the same instructor, getting genuine one-on-one minutes inside a small group. The plan is built for your child, after we’ve seen exactly where they stand.',
    instructorNote:
      'Instruction from Won Jung: B.S. Physics (UW), former engineer at Meta, Microsoft & Boeing, 15+ years tutoring, with a 100% record of students placed at top-30 universities.',
    programs: [
      {
        title: 'School Math & Test Prep',
        tag: 'Start here',
        lead: true,
        duration: 'Grade-level math through pre-calculus · SAT / placement prep',
        features: [
          'Built around your child’s actual class and where they’re headed',
          'Placement-test and HiCap prep, mapped to district windows',
          'SAT / standardized-test math when the time comes',
          'Every student on their own curriculum inside a max-4 room',
        ],
      },
      {
        title: 'AMC & Competition Math',
        tag: 'Our specialty',
        duration: 'AMC 8 · AMC 10/12 · problem-solving foundations',
        features: [
          'Genuine competition training, not extra worksheets',
          'AMC 8 (January) and AMC 10/12 (November) preparation',
          'Builds the deep problem-solving that also lifts school math',
          'For motivated students ready to stretch',
        ],
      },
      {
        title: 'Physics',
        tag: 'High school & AP',
        duration: 'Conceptual through AP Physics',
        features: [
          'Taught by a UW physics graduate and 15+ year tutor',
          'Concept-first, then the problem-solving that earns the grade',
          'Honors and AP Physics support',
          'Great pairing with upper-level math',
        ],
      },
      {
        title: 'Coding (Python)',
        tag: 'Foundations',
        duration: 'Python fundamentals · logic & problem-solving',
        features: [
          'Real programming fundamentals in Python',
          'Logical thinking that carries back into math',
          'Project-based and paced to the student',
          'A strong on-ramp before more advanced CS',
        ],
      },
    ],
    calendarHeading: 'Key dates we prep for',
    calendar: [
      ['Placement & HiCap testing', 'Fall & winter district windows. We prep on the right timeline'],
      ['AMC 10/12', 'Early November'],
      ['AMC 8', 'January'],
      ['School finals', 'December & June, with targeted review before each'],
      ['SAT test dates', 'Aug, Oct, Nov, Dec, Mar, May, Jun'],
    ],
    homeschoolNote:
      'Daytime sessions available for homeschooling families. Upper-level math, physics, and competition prep during the 9am–3pm day.',
    bottomNote: 'Every student starts with a diagnostic, so we build the right plan from day one.',
  },
  ko: {
    heading: 'Math & Test Prep',
    intro:
      '진짜 이해 위에 쌓이는 성적과 점수. 소그룹 맞춤 수업으로, 모든 학생이 자기만의 커리큘럼을 같은 선생님과 함께 진행합니다.',
    cta: '무료 진단평가 예약',
    notWorksheetHeading: '학습지 센터가 아닙니다',
    notWorksheetBody:
      '문제집만 나눠주고 끝나는 수업이 아닙니다. 모든 학생이 같은 선생님과 자기만의 커리큘럼을 따라가며, 소그룹 안에서 실질적인 1:1 지도 시간을 갖습니다. 아이의 현재 실력을 정확히 파악한 뒤, 그에 맞춘 계획을 세웁니다.',
    instructorNote:
      'Won Jung 선생님이 직접 지도합니다: UW 물리학 학사, Meta·Microsoft·Boeing 엔지니어 출신, 15년 이상의 튜터링 경력, 지도 학생 전원 미국 상위 30위권 대학 진학.',
    programs: [
      {
        title: '학교 수학 & 시험 대비',
        tag: '첫 시작',
        lead: true,
        duration: '학년별 수학부터 Pre-Calculus까지 · SAT / 배치고사 대비',
        features: [
          '아이가 실제 듣는 수업과 진로에 맞춰 설계',
          '학군 일정에 맞춘 배치고사·HiCap 대비',
          '시기가 되면 SAT 등 표준화 시험 수학까지',
          '최대 4명 교실에서 각자 자기 커리큘럼으로',
        ],
      },
      {
        title: 'AMC & 경시 수학',
        tag: '전문 분야',
        duration: 'AMC 8 · AMC 10/12 · 문제 해결력 기초',
        features: [
          '추가 문제 풀이가 아닌 진짜 경시 훈련',
          'AMC 8 (1월), AMC 10/12 (11월) 대비',
          '학교 수학까지 끌어올리는 깊이 있는 문제 해결력',
          '더 도전하고 싶은 의욕 있는 학생들을 위한 과정',
        ],
      },
      {
        title: '물리 (Physics)',
        tag: '고등 & AP',
        duration: '개념 물리부터 AP Physics까지',
        features: [
          'UW 물리학 전공, 15년 이상 경력 강사의 지도',
          '개념 먼저, 그다음 성적으로 이어지는 문제 풀이',
          'Honors & AP Physics 지원',
          '상위 수학 과정과 병행하기 좋은 과목',
        ],
      },
      {
        title: '코딩 (Python)',
        tag: '기초',
        duration: 'Python 기초 · 논리와 문제 해결',
        features: [
          'Python으로 배우는 진짜 프로그래밍 기초',
          '수학으로 이어지는 논리적 사고력',
          '학생 속도에 맞춘 프로젝트 기반 수업',
          '심화 CS로 가기 전 탄탄한 출발점',
        ],
      },
    ],
    calendarHeading: '우리가 대비하는 주요 일정',
    calendar: [
      ['배치고사 & HiCap', '가을·겨울 학군 시험 기간. 알맞은 시기에 맞춰 대비합니다'],
      ['AMC 10/12', '11월 초'],
      ['AMC 8', '1월'],
      ['학교 기말고사', '12월과 6월, 시험 전 집중 복습'],
      ['SAT 시험일', '8·10·11·12·3·5·6월'],
    ],
    homeschoolNote:
      '홈스쿨링 가정을 위한 주간 수업도 운영합니다. 오전 9시–오후 3시 사이 상위 수학, 물리, 경시 대비 수업이 가능합니다.',
    bottomNote: '모든 학생은 진단평가로 시작합니다. 첫날부터 알맞은 계획으로 시작할 수 있도록요.',
  },
};

export default function MathClient() {
  const [lang, setLang] = useState('en');
  const t = T[lang];

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
    .math-toggle { display: flex; justify-content: center; gap: 0.4rem; margin-bottom: 1.5rem; }
    .math-toggle button {
        border: 1px solid #d8cdbd; background: #fff; color: #6b5b47; font-weight: 600;
        font-size: 0.88rem; padding: 0.45rem 1.3rem; border-radius: 25px; cursor: pointer;
        transition: all 0.25s ease;
    }
    .math-toggle button.on {
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
            <div className="math-toggle" role="group" aria-label="Language">
              <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? 'on' : undefined} onClick={() => setLang('en')}>
                English
              </button>
              <button type="button" aria-pressed={lang === 'ko'} className={lang === 'ko' ? 'on' : undefined} onClick={() => setLang('ko')}>
                한국어
              </button>
            </div>

            <p>{t.intro}</p>
            <div style={{ marginTop: '1.5rem' }}>
              <Link href="/diagnostic" className="btn btn-primary" style={{ padding: '0.9rem 2.25rem', fontSize: '1.05rem', flex: 'none', display: 'inline-block' }}>
                {t.cta}
              </Link>
            </div>
          </div>

          {/* Not a worksheet center */}
          <div className="learning-path">
            <h2 style={{ fontSize: '1.9rem' }}>{t.notWorksheetHeading}</h2>
            <p style={{ color: '#6b5b47', fontSize: '1.1rem', maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
              {t.notWorksheetBody}
            </p>
            <p style={{ color: '#6b5b47', textAlign: 'center', marginTop: '1rem', fontStyle: 'italic' }}>
              {t.instructorNote}
            </p>
          </div>

          {/* Programs */}
          <div className="programs-grid">
            {t.programs.map((p) => (
              <div key={p.title} className="program-card" style={p.lead ? { border: '2px solid #8b7355' } : undefined}>
                <div className="program-badge">{p.tag}</div>
                <h3>{p.title}</h3>
                <div className="program-duration">{p.duration}</div>
                <ul className="program-features">
                  {p.features.map((f) => <li key={f.slice(0, 20)}>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>

          {/* Calendar hooks (also shown on the Calendar page) */}
          <div className="faq-section">
            <h2>{t.calendarHeading}</h2>
            <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 640, margin: '0 auto' }}>
              {t.calendar.map(([label, when]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 0', borderBottom: '1px solid rgba(139,115,85,0.12)' }}>
                  <span style={{ fontWeight: 600, color: '#4a3c28' }}>{label}</span>
                  <span style={{ color: '#6b5b47', textAlign: 'right' }}>{when}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Homeschool line */}
          <div style={{ background: 'rgba(255,255,255,0.75)', borderRadius: 16, padding: '1.5rem 2rem', margin: '2rem 0', textAlign: 'center', color: '#6b5b47' }}>
            {t.homeschoolNote}
          </div>

          {/* Bottom note */}
          <div style={{ textAlign: 'center', margin: '1rem auto 3rem' }}>
            <p style={{ color: '#6b5b47', fontSize: '1.1rem' }}>
              {t.bottomNote}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
