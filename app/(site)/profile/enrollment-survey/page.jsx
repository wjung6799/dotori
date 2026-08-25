'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// New Student Enrollment Form: the website-native version of the Google Form
// "Dotori School New Student Enrollment Form 신규 학생 등록 신청서", same
// sections and questions. Filled out once per student (?student=NAME); siblings
// each get their own submission.

const BROWN = '#6b5b47';
const DARK = '#4a3c28';

const card = () => ({
  background: '#fff',
  borderRadius: 14,
  padding: '1.5rem 1.75rem',
  boxShadow: '0 8px 20px rgba(139,115,85,0.08)',
  marginBottom: '1.5rem',
});
const sectionTitle = () => ({ color: DARK, fontSize: '1.15rem', margin: '0 0 1rem' });
const lbl = () => ({ display: 'block', fontWeight: 600, color: BROWN, fontSize: '0.92rem', marginBottom: '0.35rem' });
const inp = () => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.65rem 0.8rem',
  border: '1.5px solid #ddd',
  borderRadius: 8,
  fontSize: '0.92rem',
  marginBottom: '1rem',
  background: '#fff',
});
const choice = () => ({ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: BROWN, fontSize: '0.92rem', marginBottom: '0.5rem', lineHeight: 1.5 });
const req = <span style={{ color: '#a3261a' }}> *</span>;

function SurveyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const studentName = (params.get('student') || '').trim();

  const [form, setForm] = useState({
    studentFullName: studentName,
    preferredName: '',
    grade: '',
    dateOfBirth: '',
    homeLanguage: [],
    homeLanguageOther: '',
    schoolType: '',
    schoolTypeOther: '',
    schoolDistrict: '',
    schoolDistrictOther: '',
    schoolName: '',
    parentName: '',
    parentEmail: '',
    emergencyContact: '',
    learningStyle: '',
    academicAreas: '',
    healthNotes: '',
    hobbies: '',
    otherNotes: '',
    consentPersonalInfo: false,
    consentLiability: false,
    mediaRelease: '',
    consentHandbook: false,
    referral: '',
    referralOther: '',
  });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleLang = (v) =>
    setForm((f) => ({
      ...f,
      homeLanguage: f.homeLanguage.includes(v) ? f.homeLanguage.filter((x) => x !== v) : [...f.homeLanguage, v],
    }));

  // Prefill parent info from the profile, and load a previous submission for
  // this student if one exists (resubmitting updates it).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/family/profile');
        if (res.ok && !cancelled) {
          const { user } = await res.json();
          setForm((f) => ({
            ...f,
            parentName: f.parentName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || '',
            parentEmail: f.parentEmail || user?.email || '',
            emergencyContact: f.emergencyContact || user?.phone || '',
          }));
        }
      } catch { /* prefill only */ }
      try {
        const res = await fetch('/api/family/survey');
        if (res.ok && !cancelled) {
          const { surveys } = await res.json();
          const prev = (surveys || []).find((s) => s.studentName === studentName);
          if (prev) {
            setForm((f) => ({ ...f, ...Object.fromEntries(Object.keys(f).map((k) => [k, prev[k] ?? f[k]])) }));
          }
        }
      } catch { /* fresh form */ }
    })();
    return () => { cancelled = true; };
  }, [studentName]);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    const res = await fetch('/api/family/survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, studentName }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg(d.error || 'Something went wrong. Please try again.');
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!studentName) {
    return (
      <main style={{ marginTop: 72 }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <div style={card()}>
            <p style={{ color: BROWN }}>
              Please open this form from your profile&apos;s Students section, so we know which
              student it is for. (프로필의 학생 목록에서 작성 버튼을 눌러 주세요.)
            </p>
            <Link href="/dashboard/students" style={{ color: '#8b7355', fontWeight: 700 }}>← Back to my students</Link>
          </div>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main style={{ marginTop: 72 }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <div style={{ ...card(), textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌰</div>
            <h1 style={{ color: DARK, fontSize: '1.4rem', marginBottom: '0.5rem' }}>Thank you!</h1>
            <p style={{ color: BROWN, marginBottom: '1.5rem' }}>
              The enrollment form for <strong>{studentName}</strong> has been submitted.
              ({studentName} 학생의 등록 신청서가 제출되었습니다.)
            </p>
            <Link href="/dashboard/students" className="btn btn-primary" style={{ display: 'inline-block', flex: 'none', padding: '0.7rem 1.75rem' }}>
              Back to Profile
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const showDistrict = form.schoolType === 'Public School';
  const showSchoolName = form.schoolType === 'Public School' || form.schoolType === 'Private School';

  return (
    <main style={{ marginTop: 72 }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.7rem' }}>New Student Enrollment Form<br />신규 학생 등록 신청서</h1>
          <p style={{ textAlign: 'left', fontSize: '0.95rem' }}>
            Even if we only see your child for an hour or two each week, they truly matter to us.
            To teach meaningfully, we hope to understand their interests, strengths, and needs.
            Please take a few minutes to complete this survey. Every detail helps us better support
            your child. Thank you.
          </p>
          <p style={{ textAlign: 'left', fontSize: '0.95rem' }}>
            도토리 스쿨은 매주 한두 시간 남짓 만나는 아이들이지만, 한 명 한 명을 소중하게
            생각합니다. 의미 있는 배움을 위해 아이의 관심사, 강점, 필요한 부분을 이해하고
            싶습니다. 잠시 시간을 내어 설문을 작성해 주세요. 작은 정보 하나하나가 아이를 더 잘
            지원하는 데 큰 도움이 됩니다. 감사합니다.
          </p>
          <p style={{ textAlign: 'left', fontWeight: 700, color: DARK }}>
            Student: {studentName}
          </p>
        </div>

        <form onSubmit={submit}>
          {/* ── Student Information ── */}
          <div style={card()}>
            <h2 style={sectionTitle()}>Student Information (학생 정보)</h2>

            <label style={lbl()}>Student Full Name (학생 이름){req}</label>
            <input style={inp()} value={form.studentFullName} onChange={(e) => set('studentFullName', e.target.value)} required />

            <label style={lbl()}>Preferred Name (도토리스쿨에서 불리길 원하는 이름){req}</label>
            <input style={inp()} value={form.preferredName} onChange={(e) => set('preferredName', e.target.value)} required />

            <label style={lbl()}>Current Grade (학년){req}</label>
            <input style={inp()} value={form.grade} onChange={(e) => set('grade', e.target.value)} required />

            <label style={lbl()}>Date of Birth (생년월일){req}</label>
            <input type="date" style={inp()} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} required />

            <label style={lbl()}>Home Language (가정에서 학생이 주로 사용하는 언어){req}</label>
            {['English', 'Korean'].map((v) => (
              <label key={v} style={choice()}>
                <input type="checkbox" checked={form.homeLanguage.includes(v)} onChange={() => toggleLang(v)} />
                {v}
              </label>
            ))}
            <label style={choice()}>
              <input
                type="checkbox"
                checked={form.homeLanguage.includes('Other')}
                onChange={() => toggleLang('Other')}
              />
              Other (기타):
              <input
                style={{ ...inp(), width: 180, marginBottom: 0, padding: '0.35rem 0.6rem' }}
                value={form.homeLanguageOther}
                onChange={(e) => set('homeLanguageOther', e.target.value)}
              />
            </label>

            <label style={{ ...lbl(), marginTop: '1rem' }}>Current School Type (현재 재학 중인 학교 유형){req}</label>
            {['Public School', 'Private School', 'Homeschool'].map((v) => (
              <label key={v} style={choice()}>
                <input type="radio" name="schoolType" checked={form.schoolType === v} onChange={() => set('schoolType', v)} required />
                {v}
              </label>
            ))}
            <label style={choice()}>
              <input type="radio" name="schoolType" checked={form.schoolType === 'Other'} onChange={() => set('schoolType', 'Other')} />
              Other (기타):
              <input
                style={{ ...inp(), width: 180, marginBottom: 0, padding: '0.35rem 0.6rem' }}
                value={form.schoolTypeOther}
                onChange={(e) => set('schoolTypeOther', e.target.value)}
              />
            </label>

            {showDistrict ? (
              <>
                <label style={{ ...lbl(), marginTop: '1rem' }}>
                  School District (교육구) — Only if Public School selected (공립학교일 경우에만 대답)
                </label>
                {['Bellevue School District', 'Lake Washington School District', 'Issaquah School District', 'Northshore School District'].map((v) => (
                  <label key={v} style={choice()}>
                    <input type="radio" name="schoolDistrict" checked={form.schoolDistrict === v} onChange={() => set('schoolDistrict', v)} />
                    {v}
                  </label>
                ))}
                <label style={choice()}>
                  <input type="radio" name="schoolDistrict" checked={form.schoolDistrict === 'Other'} onChange={() => set('schoolDistrict', 'Other')} />
                  Other (기타):
                  <input
                    style={{ ...inp(), width: 220, marginBottom: 0, padding: '0.35rem 0.6rem' }}
                    value={form.schoolDistrictOther}
                    onChange={(e) => set('schoolDistrictOther', e.target.value)}
                  />
                </label>
              </>
            ) : null}

            {showSchoolName ? (
              <>
                <label style={{ ...lbl(), marginTop: '1rem' }}>
                  School Name (학교 이름) — Only if Public or Private selected (공립 혹은 사립학교일 경우에만 대답)
                </label>
                <input style={inp()} value={form.schoolName} onChange={(e) => set('schoolName', e.target.value)} />
              </>
            ) : null}
          </div>

          {/* ── Parent/Guardian Information ── */}
          <div style={card()}>
            <h2 style={sectionTitle()}>Parent/Guardian Information (학부모/보호자 정보)</h2>

            <label style={lbl()}>Parent/Guardian Name (부모/보호자 성함){req}</label>
            <input style={inp()} value={form.parentName} onChange={(e) => set('parentName', e.target.value)} required />

            <label style={lbl()}>Email Address (이메일 주소){req}</label>
            <input type="email" style={inp()} value={form.parentEmail} onChange={(e) => set('parentEmail', e.target.value)} required />

            <label style={lbl()}>Emergency Contact Number (비상 연락처){req}</label>
            <input type="tel" style={inp()} value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} required />
          </div>

          {/* ── About the Student ── */}
          <div style={card()}>
            <h2 style={sectionTitle()}>About the Student (학생에 대해 꼭 알아야 할 사항)</h2>

            <label style={lbl()}>Learning style or personality (학습 성향){req}</label>
            <input style={inp()} value={form.learningStyle} onChange={(e) => set('learningStyle', e.target.value)} required />

            <label style={lbl()}>Academic areas they enjoy or find challenging (좋아하거나 어려워하는 학습분야){req}</label>
            <input style={inp()} value={form.academicAreas} onChange={(e) => set('academicAreas', e.target.value)} required />

            <label style={lbl()}>Health, allergies, or any special needs (건강, 알레르기, 특이사항){req}</label>
            <input style={inp()} value={form.healthNotes} onChange={(e) => set('healthNotes', e.target.value)} required />

            <label style={lbl()}>Current sports, instruments, or hobbies (참여 중인 스포츠나 악기, 취미 활동){req}</label>
            <input style={inp()} value={form.hobbies} onChange={(e) => set('hobbies', e.target.value)} required />

            <label style={lbl()}>Anything else you would like the teacher to know (교사에게 전달하고 싶은 기타 사항)</label>
            <p style={{ color: '#9b8b77', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
              한국어수업을 듣는 학생이라면 학생의 기본 한국어 실력이나 한국어를 배운 경험에 대해
              알려주시면 큰 도움이 됩니다. For students enrolling in the Korean class, letting us
              know their Korean proficiency and any previous Korean-learning experience would be a
              great help.
            </p>
            <textarea rows={4} style={inp()} value={form.otherNotes} onChange={(e) => set('otherNotes', e.target.value)} />
          </div>

          {/* ── Consent ── */}
          <div style={card()}>
            <h2 style={sectionTitle()}>Consent (동의서)</h2>

            <label style={lbl()}>Personal Information (개인정보 수집){req}</label>
            <label style={choice()}>
              <input type="checkbox" checked={form.consentPersonalInfo} onChange={(e) => set('consentPersonalInfo', e.target.checked)} required />
              I agree to the collection and use of personal information for enrollment purposes.
              (등록을 위한 개인정보 수집 및 이용에 동의합니다.)
            </label>

            <label style={{ ...lbl(), marginTop: '1rem' }}>Liability Waiver (법적 책임 면제 동의){req}</label>
            <label style={choice()}>
              <input type="checkbox" checked={form.consentLiability} onChange={(e) => set('consentLiability', e.target.checked)} required />
              I understand and agree that Dotori School is not liable for any injuries, accidents,
              or unforeseen incidents that may occur during classes or school activities.
              (수업 및 활동 중 발생할 수 있는 부상이나 사고에 대해 도토리스쿨은 법적 책임이 없음을
              이해하고 동의합니다.)
            </label>

            <label style={{ ...lbl(), marginTop: '1rem' }}>Media Release (사진과 영상 사용) — Optional 선택사항{req}</label>
            <label style={choice()}>
              <input type="radio" name="mediaRelease" checked={form.mediaRelease === 'agree'} onChange={() => set('mediaRelease', 'agree')} required />
              I give permission for my child&rsquo;s photos/videos to be used for Dotori School
              materials or promotional purposes. (자녀의 사진/영상이 도토리스쿨 자료 또는
              웹사이트/미디어 홍보 목적으로 사용되는 것에 동의합니다.)
            </label>
            <label style={choice()}>
              <input type="radio" name="mediaRelease" checked={form.mediaRelease === 'decline'} onChange={() => set('mediaRelease', 'decline')} />
              Sorry, not this time (동의하지 않습니다.)
            </label>

            <label style={{ ...lbl(), marginTop: '1rem' }}>Family Handbook Acknowledgment (도토리스쿨 생활 안내서 확인){req}</label>
            <label style={choice()}>
              <input type="checkbox" checked={form.consentHandbook} onChange={(e) => set('consentHandbook', e.target.checked)} required />
              I acknowledge that I have read and understood the Dotori School Family Handbook, and
              I agree to comply with the school&rsquo;s policies and guidelines.
              (도토리스쿨 생활 안내서에 나온 정책과 지침을 준수할 것에 동의합니다.)
            </label>
          </div>

          {/* ── Last Question ── */}
          <div style={card()}>
            <h2 style={sectionTitle()}>Last Question (마지막 질문입니다 🙂)</h2>

            <label style={lbl()}>How did you hear about Dotori School? (도토리스쿨에 대해 어떻게 알게 되셨나요?){req}</label>
            {['Social Media (소셜 미디어)', 'Friend or Family Referral (지인 추천)', 'Google Search / Online Ad (구글 검색/온라인 광고)'].map((v) => (
              <label key={v} style={choice()}>
                <input type="radio" name="referral" checked={form.referral === v} onChange={() => set('referral', v)} required />
                {v}
              </label>
            ))}
            <label style={choice()}>
              <input type="radio" name="referral" checked={form.referral === 'Other'} onChange={() => set('referral', 'Other')} />
              Other (기타):
              <input
                style={{ ...inp(), width: 220, marginBottom: 0, padding: '0.35rem 0.6rem' }}
                value={form.referralOther}
                onChange={(e) => set('referralOther', e.target.value)}
              />
            </label>
          </div>

          {msg ? (
            <p style={{ color: '#a3261a', fontWeight: 600 }}>{msg}</p>
          ) : null}

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '3rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 'none', padding: '0.85rem 2.25rem' }}>
              {saving ? 'Submitting…' : 'Submit (제출하기)'}
            </button>
            <Link href="/dashboard/students" style={{ color: '#9b8b77', fontWeight: 600 }}>Cancel</Link>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function EnrollmentSurveyPage() {
  return (
    <Suspense fallback={null}>
      <SurveyForm />
    </Suspense>
  );
}
