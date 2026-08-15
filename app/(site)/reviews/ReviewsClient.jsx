'use client';

import { useEffect, useState } from 'react';

// Parent reviews page: four program tabs (Math, Literacy, Korean, Summer Camp),
// approved reviews only, plus a submit form (new reviews appear after an admin
// approves them at /admin/reviews). English/Korean toggle for the UI labels.

const BROWN = '#6b5b47';
const DARK = '#4a3c28';

const T = {
  en: {
    heading: 'Parent Reviews',
    intro: 'What Dotori families say about our programs.',
    tabs: [
      ['math', 'Math & Test Prep'],
      ['literacy', 'English Literacy'],
      ['korean', 'Korean'],
      ['summer', 'Summer Camp'],
    ],
    empty: 'No reviews for this program yet. Be the first to write one below!',
    formTitle: 'Write a Review',
    formIntro: 'Your review will appear once it has been approved.',
    name: 'Your Name (shown with the review)',
    namePh: 'e.g. Grace K.',
    program: 'Program',
    rating: 'Rating',
    review: 'Your Review',
    submit: 'Submit Review',
    submitting: 'Submitting…',
    done: 'Thank you! Your review has been submitted and will appear once approved.',
  },
  ko: {
    heading: '학부모 후기',
    intro: '도토리스쿨 가족들이 전하는 프로그램 이야기입니다.',
    tabs: [
      ['math', '수학 프로그램'],
      ['literacy', '리터러시 프로그램'],
      ['korean', '한국어 프로그램'],
      ['summer', '써머캠프'],
    ],
    empty: '아직 이 프로그램의 후기가 없습니다. 아래에서 첫 후기를 남겨 주세요!',
    formTitle: '후기 작성하기',
    formIntro: '작성하신 후기는 승인 후 게시됩니다.',
    name: '이름 (후기와 함께 표시됩니다)',
    namePh: '예: Grace K.',
    program: '프로그램',
    rating: '별점',
    review: '후기 내용',
    submit: '후기 제출',
    submitting: '제출 중…',
    done: '감사합니다! 후기가 제출되었으며 승인 후 게시됩니다.',
  },
};

const Stars = ({ n }) => (
  <span style={{ color: '#d9a83c', letterSpacing: 2 }} aria-label={`${n} out of 5 stars`}>
    {'★'.repeat(n)}
    <span style={{ color: '#e6ddd2' }}>{'★'.repeat(5 - n)}</span>
  </span>
);

export default function ReviewsClient() {
  const [lang, setLang] = useState('en');
  const [program, setProgram] = useState('math');
  const [reviews, setReviews] = useState(null); // all approved, filtered client-side
  const t = T[lang];

  const [form, setForm] = useState({ parentName: '', program: 'math', rating: 5, text: '', website: '' });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews || []))
      .catch(() => setReviews([]));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    const res = await fetch('/api/reviews', {
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

  const shown = (reviews || []).filter((r) => r.program === program);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
    .rv-toggle { display: flex; justify-content: center; gap: 0.4rem; margin-bottom: 1.5rem; }
    .rv-toggle button {
        border: 1px solid #d8cdbd; background: #fff; color: #6b5b47; font-weight: 600;
        font-size: 0.88rem; padding: 0.45rem 1.3rem; border-radius: 25px; cursor: pointer;
        transition: all 0.25s ease;
    }
    .rv-toggle button.on {
        background: linear-gradient(135deg, #8b7355, #a0856b); color: #fff; border-color: transparent;
    }

    .rv-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin: 0 0 1.75rem; }
    .rv-tabs button {
        border: 1.5px solid #d8cdbd; background: #fff; color: #6b5b47; font-weight: 600;
        font-size: 0.92rem; padding: 0.55rem 1.4rem; border-radius: 25px; cursor: pointer;
        transition: all 0.25s ease;
    }
    .rv-tabs button.on { background: #8b7355; border-color: #8b7355; color: #fff; }

    .rv-grid { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-bottom: 3rem; }
    .rv-card {
        background: #fff; border-radius: 14px; padding: 1.5rem;
        box-shadow: 0 8px 20px rgba(139,115,85,0.08);
    }
    .rv-card blockquote { margin: 0.5rem 0 0.9rem; color: #4a3c28; line-height: 1.6; font-size: 0.96rem; white-space: pre-wrap; }
    .rv-card .rv-who { color: #8b7355; font-weight: 700; font-size: 0.9rem; }
    .rv-card .rv-date { color: #b8ab98; font-weight: 400; font-size: 0.8rem; }

    .rv-form {
        background: #fff; border-radius: 14px; border-top: 3px solid #8b7355;
        box-shadow: 0 8px 20px rgba(139,115,85,0.08);
        padding: 1.75rem; margin: 0 auto 3rem; max-width: 620px;
    }
    .rv-form h2 { color: #4a3c28; font-size: 1.25rem; margin: 0 0 0.3rem; }
    .rv-form .rv-form-intro { color: #9b8b77; font-size: 0.9rem; margin: 0 0 1.2rem; }
    .rv-form label { display: block; font-weight: 600; color: #6b5b47; font-size: 0.9rem; margin-bottom: 0.3rem; }
    .rv-form input, .rv-form select, .rv-form textarea {
        width: 100%; box-sizing: border-box; padding: 0.6rem 0.8rem; border: 1.5px solid #ddd;
        border-radius: 8px; font-size: 0.92rem; margin-bottom: 0.9rem; background: #fff; font-family: inherit;
    }
    .rv-star-pick { display: flex; gap: 0.2rem; margin-bottom: 0.9rem; }
    .rv-star-pick button { background: none; border: none; font-size: 1.6rem; cursor: pointer; padding: 0 2px; line-height: 1; }
    .rv-hp { position: absolute; left: -9999px; opacity: 0; height: 0; overflow: hidden; }
`,
        }}
      />

      <main lang={lang}>
        <div className="container" style={{ maxWidth: 960 }}>
          <div className="page-header">
            <h1>{t.heading}</h1>

            {/* Language toggle */}
            <div className="rv-toggle" role="group" aria-label="Language">
              <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? 'on' : undefined} onClick={() => setLang('en')}>
                English
              </button>
              <button type="button" aria-pressed={lang === 'ko'} className={lang === 'ko' ? 'on' : undefined} onClick={() => setLang('ko')}>
                한국어
              </button>
            </div>

            <p>{t.intro}</p>
          </div>

          {/* Program tabs */}
          <div className="rv-tabs" role="tablist">
            {t.tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={program === key}
                className={program === key ? 'on' : undefined}
                onClick={() => setProgram(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Reviews */}
          {reviews === null ? (
            <p style={{ textAlign: 'center', color: '#9b8b77', marginBottom: '3rem' }}>Loading…</p>
          ) : shown.length === 0 ? (
            <p style={{ textAlign: 'center', color: BROWN, marginBottom: '3rem' }}>{t.empty}</p>
          ) : (
            <div className="rv-grid">
              {shown.map((r) => (
                <figure className="rv-card" key={r._id} style={{ margin: 0 }}>
                  <Stars n={r.rating || 5} />
                  <blockquote>“{r.text}”</blockquote>
                  <figcaption className="rv-who">
                    {r.parentName}
                    {r.createdAt ? (
                      <span className="rv-date">
                        {' · '}
                        {new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                      </span>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {/* Submit form */}
          <div className="rv-form" id="write">
            <h2>{t.formTitle}</h2>
            <p className="rv-form-intro">{t.formIntro}</p>
            {done ? (
              <p style={{ color: '#1e7a40', fontWeight: 700, margin: 0 }}>{t.done}</p>
            ) : (
              <form onSubmit={submit}>
                {/* Honeypot: humans never see or fill this. */}
                <div className="rv-hp" aria-hidden="true">
                  <label htmlFor="rv-website">Website</label>
                  <input id="rv-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
                </div>

                <label>{t.name}</label>
                <input value={form.parentName} placeholder={t.namePh} onChange={(e) => set('parentName', e.target.value)} required />

                <label>{t.program}</label>
                <select value={form.program} onChange={(e) => set('program', e.target.value)}>
                  {t.tabs.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>

                <label>{t.rating}</label>
                <div className="rv-star-pick" role="radiogroup" aria-label={t.rating}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={form.rating === n}
                      onClick={() => set('rating', n)}
                      style={{ color: n <= form.rating ? '#d9a83c' : '#e6ddd2' }}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <label>{t.review}</label>
                <textarea rows={5} value={form.text} onChange={(e) => set('text', e.target.value)} required />

                {msg ? <p style={{ color: '#a3261a', fontWeight: 600 }}>{msg}</p> : null}

                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 'none', padding: '0.8rem 2.25rem' }}>
                  {saving ? t.submitting : t.submit}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
