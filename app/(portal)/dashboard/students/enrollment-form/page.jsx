'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// New Student Enrollment Form: the portal-native version of the Google Form
// "Dotori School New Student Enrollment Form 신규 학생 등록 신청서", same
// sections and questions. Filled out once per student (?student=NAME); siblings
// each get their own submission. Re-submitting updates the existing row —
// /api/family/survey upserts on userId + studentName.

// Radio/checkbox rows have no portal class of their own. These two inline
// styles are the whole exception: the row overrides `.field label` (block,
// bold) back to a flex line of normal text, and `box` keeps the control at its
// natural size instead of the 100% that `.field input` would stretch it to.
const choiceRow = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.5rem',
  color: 'var(--ink-2)',
  fontSize: '0.9rem',
  fontWeight: 400,
  lineHeight: 1.5,
  marginBottom: '0.45rem',
};
const box = { width: 'auto', flex: 'none', padding: 0, margin: '0.25rem 0 0', accentColor: 'var(--brown-mid)' };
const otherInput = { width: 180, flex: 'none', padding: '0.32rem 0.55rem', fontSize: '0.88rem' };
const otherInputWide = { ...otherInput, width: 220 };

const req = <span style={{ color: 'var(--err)' }}> *</span>;

function SurveyForm() {
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
    // Home Language is a checkbox group, and a checkbox group has no native
    // "at least one" validation the way a radio group does. Without this guard
    // the form happily posts homeLanguage: [] and the server bounces it with a
    // raw field name. Every other required field is covered by `required`.
    if (form.homeLanguage.length === 0) {
      setMsg('Please choose at least one home language. (가정에서 사용하는 언어를 하나 이상 선택해 주세요.)');
      return;
    }
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
      <>
        <div className="page-head">
          <div>
            <h1>New Student Enrollment Form</h1>
            <p className="lede">신규 학생 등록 신청서</p>
          </div>
        </div>
        <section className="card">
          <p className="muted">
            Please open this form from your Students page, so we know which student it is for.
            (학생 목록에서 작성 버튼을 눌러 주세요.)
          </p>
          <Link className="btn btn-primary" href="/dashboard/students">← Back to my students</Link>
        </section>
      </>
    );
  }

  if (done) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Thank you! 🌰</h1>
            <p className="lede">신규 학생 등록 신청서가 제출되었습니다.</p>
          </div>
        </div>
        <section className="card">
          <div className="notice ok">
            The enrollment form for <strong>{studentName}</strong> has been submitted.
            ({studentName} 학생의 등록 신청서가 제출되었습니다.)
          </div>
          <p className="muted small">
            You can edit this form at any time from your Students page — open it again and re-submit,
            and it will update this submission rather than create a new one.
            (학생 목록에서 언제든지 수정하실 수 있습니다.)
          </p>
          <Link className="btn btn-primary" href="/dashboard/students">Back to Students</Link>
        </section>
      </>
    );
  }

  // Changing school type hides the follow-up questions, so clear their answers
  // too — otherwise a family that switches from Public School to Homeschool
  // still submits the district and school name they picked first.
  function setSchoolType(v) {
    setForm((f) => ({
      ...f,
      schoolType: v,
      schoolTypeOther: v === 'Other' ? f.schoolTypeOther : '',
      schoolDistrict: v === 'Public School' ? f.schoolDistrict : '',
      schoolDistrictOther: v === 'Public School' ? f.schoolDistrictOther : '',
      schoolName: v === 'Public School' || v === 'Private School' ? f.schoolName : '',
    }));
  }

  const showDistrict = form.schoolType === 'Public School';
  const showSchoolName = form.schoolType === 'Public School' || form.schoolType === 'Private School';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New Student Enrollment Form</h1>
          <p className="lede">신규 학생 등록 신청서 · Student: <span className="strong">{studentName}</span></p>
        </div>
      </div>

      <section className="card">
        <p className="muted small mt0">
          Even if we only see your child for an hour or two each week, they truly matter to us.
          To teach meaningfully, we hope to understand their interests, strengths, and needs.
          Please take a few minutes to complete this survey. Every detail helps us better support
          your child. Thank you.
        </p>
        <p className="muted small mb0">
          도토리 스쿨은 매주 한두 시간 남짓 만나는 아이들이지만, 한 명 한 명을 소중하게
          생각합니다. 의미 있는 배움을 위해 아이의 관심사, 강점, 필요한 부분을 이해하고
          싶습니다. 잠시 시간을 내어 설문을 작성해 주세요. 작은 정보 하나하나가 아이를 더 잘
          지원하는 데 큰 도움이 됩니다. 감사합니다.
        </p>
      </section>

      <form onSubmit={submit}>
        {/* ── Student Information ── */}
        <section className="card">
          <div className="card-head">
            <h2>Student Information (학생 정보)</h2>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="studentFullName">Student Full Name (학생 이름){req}</label>
              <input id="studentFullName" value={form.studentFullName} onChange={(e) => set('studentFullName', e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="preferredName">Preferred Name (도토리스쿨에서 불리길 원하는 이름){req}</label>
              <input id="preferredName" value={form.preferredName} onChange={(e) => set('preferredName', e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="grade">Current Grade (학년){req}</label>
              <input id="grade" value={form.grade} onChange={(e) => set('grade', e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="dateOfBirth">Date of Birth (생년월일){req}</label>
              <input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <div className="flabel">Home Language (가정에서 학생이 주로 사용하는 언어){req}</div>
            {['English', 'Korean'].map((v) => (
              <label key={v} style={choiceRow}>
                <input type="checkbox" style={box} checked={form.homeLanguage.includes(v)} onChange={() => toggleLang(v)} />
                {v}
              </label>
            ))}
            <label style={choiceRow}>
              <input
                type="checkbox"
                style={box}
                checked={form.homeLanguage.includes('Other')}
                onChange={() => toggleLang('Other')}
              />
              Other (기타):
              <input
                style={otherInput}
                value={form.homeLanguageOther}
                onChange={(e) => set('homeLanguageOther', e.target.value)}
              />
            </label>
          </div>

          <div className="field">
            <div className="flabel">Current School Type (현재 재학 중인 학교 유형){req}</div>
            {['Public School', 'Private School', 'Homeschool'].map((v) => (
              <label key={v} style={choiceRow}>
                <input type="radio" name="schoolType" style={box} checked={form.schoolType === v} onChange={() => setSchoolType(v)} required />
                {v}
              </label>
            ))}
            <label style={choiceRow}>
              <input type="radio" name="schoolType" style={box} checked={form.schoolType === 'Other'} onChange={() => setSchoolType('Other')} />
              Other (기타):
              <input
                style={otherInput}
                value={form.schoolTypeOther}
                onChange={(e) => set('schoolTypeOther', e.target.value)}
              />
            </label>
          </div>

          {showDistrict ? (
            <div className="field">
              <div className="flabel">
                School District (교육구) — Only if Public School selected (공립학교일 경우에만 대답)
              </div>
              {['Bellevue School District', 'Lake Washington School District', 'Issaquah School District', 'Northshore School District'].map((v) => (
                <label key={v} style={choiceRow}>
                  <input type="radio" name="schoolDistrict" style={box} checked={form.schoolDistrict === v} onChange={() => set('schoolDistrict', v)} />
                  {v}
                </label>
              ))}
              <label style={choiceRow}>
                <input type="radio" name="schoolDistrict" style={box} checked={form.schoolDistrict === 'Other'} onChange={() => set('schoolDistrict', 'Other')} />
                Other (기타):
                <input
                  style={otherInputWide}
                  value={form.schoolDistrictOther}
                  onChange={(e) => set('schoolDistrictOther', e.target.value)}
                />
              </label>
            </div>
          ) : null}

          {showSchoolName ? (
            <div className="field mb0">
              <label htmlFor="schoolName">
                School Name (학교 이름) — Only if Public or Private selected (공립 혹은 사립학교일 경우에만 대답)
              </label>
              <input id="schoolName" value={form.schoolName} onChange={(e) => set('schoolName', e.target.value)} />
            </div>
          ) : null}
        </section>

        {/* ── Parent/Guardian Information ── */}
        <section className="card">
          <div className="card-head">
            <h2>Parent/Guardian Information (학부모/보호자 정보)</h2>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="parentName">Parent/Guardian Name (부모/보호자 성함){req}</label>
              <input id="parentName" value={form.parentName} onChange={(e) => set('parentName', e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="parentEmail">Email Address (이메일 주소){req}</label>
              <input id="parentEmail" type="email" value={form.parentEmail} onChange={(e) => set('parentEmail', e.target.value)} required />
            </div>

            <div className="field mb0">
              <label htmlFor="emergencyContact">Emergency Contact Number (비상 연락처){req}</label>
              <input id="emergencyContact" type="tel" value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} required />
            </div>
          </div>
        </section>

        {/* ── About the Student ── */}
        <section className="card">
          <div className="card-head">
            <h2>About the Student (학생에 대해 꼭 알아야 할 사항)</h2>
          </div>

          <div className="field">
            <label htmlFor="learningStyle">Learning style or personality (학습 성향){req}</label>
            <input id="learningStyle" value={form.learningStyle} onChange={(e) => set('learningStyle', e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="academicAreas">Academic areas they enjoy or find challenging (좋아하거나 어려워하는 학습분야){req}</label>
            <input id="academicAreas" value={form.academicAreas} onChange={(e) => set('academicAreas', e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="healthNotes">Health, allergies, or any special needs (건강, 알레르기, 특이사항){req}</label>
            <input id="healthNotes" value={form.healthNotes} onChange={(e) => set('healthNotes', e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="hobbies">Current sports, instruments, or hobbies (참여 중인 스포츠나 악기, 취미 활동){req}</label>
            <input id="hobbies" value={form.hobbies} onChange={(e) => set('hobbies', e.target.value)} required />
          </div>

          <div className="field mb0">
            <label htmlFor="otherNotes">Anything else you would like the teacher to know (교사에게 전달하고 싶은 기타 사항)</label>
            <textarea id="otherNotes" rows={4} value={form.otherNotes} onChange={(e) => set('otherNotes', e.target.value)} />
            <p className="hint">
              한국어수업을 듣는 학생이라면 학생의 기본 한국어 실력이나 한국어를 배운 경험에 대해
              알려주시면 큰 도움이 됩니다. For students enrolling in the Korean class, letting us
              know their Korean proficiency and any previous Korean-learning experience would be a
              great help.
            </p>
          </div>
        </section>

        {/* ── Consent ── */}
        <section className="card">
          <div className="card-head">
            <h2>Consent (동의서)</h2>
          </div>

          <div className="field">
            <div className="flabel">Personal Information (개인정보 수집){req}</div>
            <label style={choiceRow}>
              <input type="checkbox" style={box} checked={form.consentPersonalInfo} onChange={(e) => set('consentPersonalInfo', e.target.checked)} required />
              I agree to the collection and use of personal information for enrollment purposes.
              (등록을 위한 개인정보 수집 및 이용에 동의합니다.)
            </label>
          </div>

          <div className="field">
            <div className="flabel">Liability Waiver (법적 책임 면제 동의){req}</div>
            <label style={choiceRow}>
              <input type="checkbox" style={box} checked={form.consentLiability} onChange={(e) => set('consentLiability', e.target.checked)} required />
              I understand and agree that Dotori School is not liable for any injuries, accidents,
              or unforeseen incidents that may occur during classes or school activities.
              (수업 및 활동 중 발생할 수 있는 부상이나 사고에 대해 도토리스쿨은 법적 책임이 없음을
              이해하고 동의합니다.)
            </label>
          </div>

          <div className="field">
            <div className="flabel">Media Release (사진과 영상 사용) — Optional 선택사항{req}</div>
            <label style={choiceRow}>
              <input type="radio" name="mediaRelease" style={box} checked={form.mediaRelease === 'agree'} onChange={() => set('mediaRelease', 'agree')} required />
              I give permission for my child&rsquo;s photos/videos to be used for Dotori School
              materials or promotional purposes. (자녀의 사진/영상이 도토리스쿨 자료 또는
              웹사이트/미디어 홍보 목적으로 사용되는 것에 동의합니다.)
            </label>
            <label style={choiceRow}>
              <input type="radio" name="mediaRelease" style={box} checked={form.mediaRelease === 'decline'} onChange={() => set('mediaRelease', 'decline')} />
              Sorry, not this time (동의하지 않습니다.)
            </label>
          </div>

          <div className="field mb0">
            <div className="flabel">Family Handbook Acknowledgment (도토리스쿨 생활 안내서 확인){req}</div>
            <label style={choiceRow}>
              <input type="checkbox" style={box} checked={form.consentHandbook} onChange={(e) => set('consentHandbook', e.target.checked)} required />
              I acknowledge that I have read and understood the Dotori School Family Handbook, and
              I agree to comply with the school&rsquo;s policies and guidelines.
              (도토리스쿨 생활 안내서에 나온 정책과 지침을 준수할 것에 동의합니다.)
            </label>
          </div>
        </section>

        {/* ── Last Question ── */}
        <section className="card">
          <div className="card-head">
            <h2>Last Question (마지막 질문입니다 🙂)</h2>
          </div>

          <div className="field mb0">
            <div className="flabel">How did you hear about Dotori School? (도토리스쿨에 대해 어떻게 알게 되셨나요?){req}</div>
            {['Social Media (소셜 미디어)', 'Friend or Family Referral (지인 추천)', 'Google Search / Online Ad (구글 검색/온라인 광고)'].map((v) => (
              <label key={v} style={choiceRow}>
                <input type="radio" name="referral" style={box} checked={form.referral === v} onChange={() => set('referral', v)} required />
                {v}
              </label>
            ))}
            <label style={choiceRow}>
              <input type="radio" name="referral" style={box} checked={form.referral === 'Other'} onChange={() => set('referral', 'Other')} />
              Other (기타):
              <input
                style={otherInputWide}
                value={form.referralOther}
                onChange={(e) => set('referralOther', e.target.value)}
              />
            </label>
          </div>
        </section>

        {msg ? <div className="notice err">{msg}</div> : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit (제출하기)'}
          </button>
          <Link className="btn btn-ghost" href="/dashboard/students">Cancel</Link>
        </div>

        <p className="muted small" style={{ marginTop: '0.7rem' }}>
          You can come back and edit this form later from your Students page.
        </p>
      </form>
    </>
  );
}

export default function EnrollmentFormPage() {
  return (
    <Suspense fallback={null}>
      <SurveyForm />
    </Suspense>
  );
}
