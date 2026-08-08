'use client';

import { useState } from 'react';

// Private & Semi-Private Lessons page with an English/Korean toggle.
// 1:1 sessions with Mrs. Jung are full: instead of enrolling, families join a
// waitlist (form below). Admins review entries at /admin/waitlist.

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
        note: '1:1 sessions with Mrs. Jung are currently full and not accepting new students. Please join the waitlist below.',
      },
      {
        title: 'Semi-Private',
        tag: 'One teacher · two students',
        body: 'A small pairing that keeps the teacher close enough to directly support what each student needs.',
      },
    ],
    fitTitle: 'A good fit for:',
    fit: [
      'School coursework help',
      'Writing projects',
      'Personalized lessons at each student’s level',
      'Test preparation (SSAT, ISEE, Gifted programs, etc.)',
    ],
    wl: {
      title: 'Join the 1:1 Waitlist',
      intro: 'Leave your information below and we will reach out as soon as a spot opens.',
      studentName: 'Student Name',
      grade: 'Student Grade',
      parentName: 'Parent/Guardian Name',
      phone: 'Phone Number',
      email: 'Email Address',
      subject: 'Academic area you would like help with',
      subjectPh: 'e.g. Reading and writing, school math, SAT prep',
      submit: 'Join Waitlist',
      submitting: 'Submitting…',
      done: 'You are on the waitlist! We will contact you when a spot opens.',
    },
  },
  ko: {
    heading: '1:1 & 세미프라이빗 수업',
    intro: '강사와 직접 일정을 조율하는 수업입니다. 모든 학습 영역에서, 아이에게 맞춘 계획으로 진행됩니다.',
    cards: [
      {
        title: '1:1 Private',
        tag: '교사 1 : 학생 1',
        body: '읽기·쓰기부터 수학·시험 대비까지 모든 학습 영역에서 완전히 맞춤화된 수업입니다. 수업 일정은 강사와 직접 조율합니다.',
        note: 'Mrs. Jung의 1:1 수업은 현재 마감되어 신규 등록을 받지 않습니다. 아래 대기자 명단에 등록해 주세요.',
      },
      {
        title: 'Semi-Private',
        tag: '교사 1 : 학생 2',
        body: '교사가 두 학생 곁에서 각자 필요한 부분을 직접적으로 도울 수 있는 소규모 수업입니다.',
      },
    ],
    fitTitle: '이런 경우에 잘 맞아요:',
    fit: [
      '교과 도움',
      '라이팅 프로젝트',
      '수준별 맞춤 수업',
      '시험 준비 (SSAT · ISEE · Gifted 프로그램 등)',
    ],
    wl: {
      title: '1:1 수업 대기자 등록',
      intro: '아래 정보를 남겨 주시면 자리가 나는 대로 연락드리겠습니다.',
      studentName: '학생 이름',
      grade: '학생 학년',
      parentName: '학부모 이름',
      phone: '연락처',
      email: '이메일',
      subject: '수업 받고자 하는 학업 분야',
      subjectPh: '예: 읽기·쓰기, 학교 수학, SAT 대비',
      submit: '대기자 등록',
      submitting: '등록 중…',
      done: '대기자 명단에 등록되었습니다! 자리가 나면 연락드리겠습니다.',
    },
  },
};

export default function PrivateLessonsClient() {
  const [lang, setLang] = useState('en');
  const t = T[lang];

  const [form, setForm] = useState({
    studentName: '', grade: '', parentName: '', phone: '', email: '', subject: '', website: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(d.error || 'Something went wrong. Please try again.');
      return;
    }
    setDone(true);
  }

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

    .pl-cards { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); margin: 2rem 0 1.5rem; }
    .pl-card {
        background: #fff; border-radius: 14px; padding: 1.75rem;
        border-top: 3px solid #8b7355; box-shadow: 0 8px 20px rgba(139,115,85,0.08);
    }
    .pl-card h2 { color: #4a3c28; margin: 0 0 0.15rem; font-size: 1.25rem; }
    .pl-card .pl-tag { color: #b3622e; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.8rem; }
    .pl-card p { color: #6b5b47; font-size: 0.95rem; line-height: 1.6; margin: 0; }
    .pl-card .pl-note { color: #b3622e; font-weight: 700; font-size: 0.88rem; margin-top: 0.8rem; }

    .pl-fit {
        background: #fbf6e9; border: 1px solid #ecd9a8; border-radius: 12px;
        padding: 1.4rem 1.75rem; margin: 0 0 2rem;
    }
    .pl-fit h3 { color: #4a3c28; font-size: 1.05rem; margin: 0 0 0.7rem; }
    .pl-fit ul { margin: 0; padding-left: 1.2rem; color: #6b5b47; line-height: 1.7; }

    .pl-wl {
        background: #fff; border-radius: 14px; border-top: 3px solid #b3622e;
        box-shadow: 0 8px 20px rgba(139,115,85,0.08);
        padding: 1.75rem; margin: 0 0 3rem; max-width: 620px;
    }
    .pl-wl h2 { color: #4a3c28; font-size: 1.25rem; margin: 0 0 0.3rem; }
    .pl-wl .pl-wl-intro { color: #6b5b47; font-size: 0.92rem; margin: 0 0 1.2rem; }
    .pl-wl label { display: block; font-weight: 600; color: #6b5b47; font-size: 0.9rem; margin-bottom: 0.3rem; }
    .pl-wl input, .pl-wl textarea {
        width: 100%; box-sizing: border-box; padding: 0.6rem 0.8rem; border: 1.5px solid #ddd;
        border-radius: 8px; font-size: 0.92rem; margin-bottom: 0.9rem; background: #fff; font-family: inherit;
    }
    .pl-wl .pl-hp { position: absolute; left: -9999px; opacity: 0; height: 0; overflow: hidden; }
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
              </div>
            ))}
          </div>

          {/* Applies to both 1:1 and Semi-Private. */}
          <div className="pl-fit">
            <h3>{t.fitTitle}</h3>
            <ul>
              {t.fit.map((f) => (
                <li key={f.slice(0, 20)}>{f}</li>
              ))}
            </ul>
          </div>

          {/* 1:1 waitlist */}
          <div className="pl-wl" id="waitlist">
            <h2>{t.wl.title}</h2>
            <p className="pl-wl-intro">{t.wl.intro}</p>
            {done ? (
              <p style={{ color: '#1e7a40', fontWeight: 700 }}>{t.wl.done}</p>
            ) : (
              <form onSubmit={submit}>
                {/* Honeypot: humans never see or fill this. */}
                <div className="pl-hp" aria-hidden="true">
                  <label htmlFor="pl-website">Website</label>
                  <input id="pl-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
                </div>

                <label>{t.wl.studentName}</label>
                <input value={form.studentName} onChange={(e) => set('studentName', e.target.value)} required />

                <label>{t.wl.grade}</label>
                <input value={form.grade} onChange={(e) => set('grade', e.target.value)} required />

                <label>{t.wl.parentName}</label>
                <input value={form.parentName} onChange={(e) => set('parentName', e.target.value)} required />

                <label>{t.wl.phone}</label>
                <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />

                <label>{t.wl.email}</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />

                <label>{t.wl.subject}</label>
                <textarea rows={2} placeholder={t.wl.subjectPh} value={form.subject} onChange={(e) => set('subject', e.target.value)} required />

                {msg ? <p style={{ color: '#a3261a', fontWeight: 600, marginTop: 0 }}>{msg}</p> : null}

                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 'none', padding: '0.75rem 1.9rem' }}>
                  {saving ? t.wl.submitting : t.wl.submit}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
