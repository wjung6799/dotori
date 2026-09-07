'use client';

// One submitted enrollment survey, spelled out field by field. Shared by the
// standalone /admin/surveys viewer and the Families tab\'s expandable rows, so
// the two can never drift on which fields exist.
const BROWN = '#6b5b47';

export const SURVEY_FIELDS = [
  ['studentFullName', 'Student Full Name'],
  ['preferredName', 'Preferred Name'],
  ['grade', 'Current Grade'],
  ['dateOfBirth', 'Date of Birth'],
  ['homeLanguage', 'Home Language'],
  ['homeLanguageOther', 'Home Language (Other)'],
  ['schoolType', 'School Type'],
  ['schoolTypeOther', 'School Type (Other)'],
  ['schoolDistrict', 'School District'],
  ['schoolDistrictOther', 'School District (Other)'],
  ['schoolName', 'School Name'],
  ['parentName', 'Parent/Guardian Name'],
  ['parentEmail', 'Email'],
  ['emergencyContact', 'Emergency Contact'],
  ['learningStyle', 'Learning style / personality'],
  ['academicAreas', 'Areas they enjoy / find challenging'],
  ['healthNotes', 'Health, allergies, special needs'],
  ['hobbies', 'Sports, instruments, hobbies'],
  ['otherNotes', 'Anything else for the teacher'],
  ['mediaRelease', 'Media Release'],
  ['referral', 'How did you hear about us'],
  ['referralOther', 'Referral (Other)'],
];

export default function SurveyDetails({ survey }) {
  return (
    <div style={{ borderTop: '1px solid #f0e9df', padding: '1rem 1.2rem', display: 'grid', gap: '0.5rem' }}>
      {SURVEY_FIELDS.map(([key, label]) => {
        const raw = survey[key];
        const value = Array.isArray(raw) ? raw.join(', ') : raw;
        if (!value) return null;
        return (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
            <span style={{ color: '#9b8b77', fontWeight: 600 }}>{label}</span>
            <span style={{ color: BROWN, whiteSpace: 'pre-wrap' }}>{value}</span>
          </div>
        );
      })}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
        <span style={{ color: '#9b8b77', fontWeight: 600 }}>Consents</span>
        <span style={{ color: BROWN }}>
          Personal info ✓ · Liability waiver ✓ · Handbook ✓ · Media release: {survey.mediaRelease === 'agree' ? 'agreed' : 'declined'}
        </span>
      </div>
    </div>
  );
}
