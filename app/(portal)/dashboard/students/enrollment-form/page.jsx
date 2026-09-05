'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// New Student Enrollment Form: the portal-native version of the Google Form
// "Dotori School New Student Enrollment Form", same
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
      setMsg('Please choose at least one home language.');
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
          </div>
        </div>
        <section className="card">
          <p className="muted">
            Please open this form from your Students page, so we know which student it is for.
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
            <p className="lede">Your enrollment form has been submitted.</p>
          </div>
        </div>
        <section className="card">
          <div className="notice ok">
            The enrollment form for <strong>{studentName}</strong> has been submitted.
          </div>
          <p className="muted small">
            You can edit this form at any time from your Students page — open it again and re-submit,
            and it will update this submission rather than create a new one.
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
          <p className="lede">Student: <span className="strong">{studentName}</span></p>
        </div>
      </div>

      <section className="card">
        <p className="muted small mt0">
          Even if we only see your child for an hour or two each week, they truly matter to us.
          To teach meaningfully, we hope to understand their interests, strengths, and needs.
          Please take a few minutes to complete this survey. Every detail helps us better support
          your child. Thank you.
        </p>
      </section>

      <form onSubmit={submit}>
        {/* ── Student Information ── */}
        <section className="card">
          <div className="card-head">
            <h2>Student Information</h2>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="studentFullName">Student Full Name{req}</label>
              <input id="studentFullName" value={form.studentFullName} onChange={(e) => set('studentFullName', e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="preferredName">Preferred Name{req}</label>
              <input id="preferredName" value={form.preferredName} onChange={(e) => set('preferredName', e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="grade">Current Grade{req}</label>
              <input id="grade" value={form.grade} onChange={(e) => set('grade', e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="dateOfBirth">Date of Birth{req}</label>
              <input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <div className="flabel">Home Language{req}</div>
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
              Other:
              <input
                style={otherInput}
                value={form.homeLanguageOther}
                onChange={(e) => set('homeLanguageOther', e.target.value)}
              />
            </label>
          </div>

          <div className="field">
            <div className="flabel">Current School Type{req}</div>
            {['Public School', 'Private School', 'Homeschool'].map((v) => (
              <label key={v} style={choiceRow}>
                <input type="radio" name="schoolType" style={box} checked={form.schoolType === v} onChange={() => setSchoolType(v)} required />
                {v}
              </label>
            ))}
            <label style={choiceRow}>
              <input type="radio" name="schoolType" style={box} checked={form.schoolType === 'Other'} onChange={() => setSchoolType('Other')} />
              Other:
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
                School District — Only if Public School selected
              </div>
              {['Bellevue School District', 'Lake Washington School District', 'Issaquah School District', 'Northshore School District'].map((v) => (
                <label key={v} style={choiceRow}>
                  <input type="radio" name="schoolDistrict" style={box} checked={form.schoolDistrict === v} onChange={() => set('schoolDistrict', v)} />
                  {v}
                </label>
              ))}
              <label style={choiceRow}>
                <input type="radio" name="schoolDistrict" style={box} checked={form.schoolDistrict === 'Other'} onChange={() => set('schoolDistrict', 'Other')} />
                Other:
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
                School Name — Only if Public or Private selected
              </label>
              <input id="schoolName" value={form.schoolName} onChange={(e) => set('schoolName', e.target.value)} />
            </div>
          ) : null}
        </section>

        {/* ── Parent/Guardian Information ── */}
        <section className="card">
          <div className="card-head">
            <h2>Parent/Guardian Information</h2>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="parentName">Parent/Guardian Name{req}</label>
              <input id="parentName" value={form.parentName} onChange={(e) => set('parentName', e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="parentEmail">Email Address{req}</label>
              <input id="parentEmail" type="email" value={form.parentEmail} onChange={(e) => set('parentEmail', e.target.value)} required />
            </div>

            <div className="field mb0">
              <label htmlFor="emergencyContact">Emergency Contact Number{req}</label>
              <input id="emergencyContact" type="tel" value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} required />
            </div>
          </div>
        </section>

        {/* ── About the Student ── */}
        <section className="card">
          <div className="card-head">
            <h2>About the Student</h2>
          </div>

          <div className="field">
            <label htmlFor="learningStyle">Learning style or personality{req}</label>
            <input id="learningStyle" value={form.learningStyle} onChange={(e) => set('learningStyle', e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="academicAreas">Academic areas they enjoy or find challenging{req}</label>
            <input id="academicAreas" value={form.academicAreas} onChange={(e) => set('academicAreas', e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="healthNotes">Health, allergies, or any special needs{req}</label>
            <input id="healthNotes" value={form.healthNotes} onChange={(e) => set('healthNotes', e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="hobbies">Current sports, instruments, or hobbies{req}</label>
            <input id="hobbies" value={form.hobbies} onChange={(e) => set('hobbies', e.target.value)} required />
          </div>

          <div className="field mb0">
            <label htmlFor="otherNotes">Anything else you would like the teacher to know</label>
            <textarea id="otherNotes" rows={4} value={form.otherNotes} onChange={(e) => set('otherNotes', e.target.value)} />
            <p className="hint">
              For students enrolling in the Korean class, letting us
              know their Korean proficiency and any previous Korean-learning experience would be a
              great help.
            </p>
          </div>
        </section>

        {/* ── Consent ── */}
        <section className="card">
          <div className="card-head">
            <h2>Consent</h2>
          </div>

          <div className="field">
            <div className="flabel">Personal Information{req}</div>
            <label style={choiceRow}>
              <input type="checkbox" style={box} checked={form.consentPersonalInfo} onChange={(e) => set('consentPersonalInfo', e.target.checked)} required />
              I agree to the collection and use of personal information for enrollment purposes.
            </label>
          </div>

          <div className="field">
            <div className="flabel">Liability Waiver{req}</div>
            <label style={choiceRow}>
              <input type="checkbox" style={box} checked={form.consentLiability} onChange={(e) => set('consentLiability', e.target.checked)} required />
              I understand and agree that Dotori School is not liable for any injuries, accidents,
              or unforeseen incidents that may occur during classes or school activities.
            </label>
          </div>

          <div className="field">
            <div className="flabel">Media Release — Optional{req}</div>
            <label style={choiceRow}>
              <input type="radio" name="mediaRelease" style={box} checked={form.mediaRelease === 'agree'} onChange={() => set('mediaRelease', 'agree')} required />
              I give permission for my child&rsquo;s photos/videos to be used for Dotori School
              materials or promotional purposes.
            </label>
            <label style={choiceRow}>
              <input type="radio" name="mediaRelease" style={box} checked={form.mediaRelease === 'decline'} onChange={() => set('mediaRelease', 'decline')} />
              Sorry, not this time
            </label>
          </div>

          <div className="field mb0">
            <div className="flabel">Family Handbook Acknowledgment{req}</div>
            <label style={choiceRow}>
              <input type="checkbox" style={box} checked={form.consentHandbook} onChange={(e) => set('consentHandbook', e.target.checked)} required />
              <span>
                I acknowledge that I have read and understood the{' '}
                {/* The handbook itself, one click away — nobody should have to
                    attest to a document they were never handed. */}
                <a
                  href="/docs/family-handbook-2026-27.pdf"
                  target="_blank"
                  rel="noopener"
                  style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Dotori School Family Handbook
                </a>
                , and I agree to comply with the school&rsquo;s policies and guidelines.
              </span>
            </label>
          </div>
        </section>

        {/* ── Last Question ── */}
        <section className="card">
          <div className="card-head">
            <h2>Last Question 🙂</h2>
          </div>

          <div className="field mb0">
            <div className="flabel">How did you hear about Dotori School?{req}</div>
            {['Social Media', 'Friend or Family Referral', 'Google Search / Online Ad'].map((v) => (
              <label key={v} style={choiceRow}>
                <input type="radio" name="referral" style={box} checked={form.referral === v} onChange={() => set('referral', v)} required />
                {v}
              </label>
            ))}
            <label style={choiceRow}>
              <input type="radio" name="referral" style={box} checked={form.referral === 'Other'} onChange={() => set('referral', 'Other')} />
              Other:
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
            {saving ? 'Submitting…' : 'Submit'}
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
