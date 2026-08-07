import dbConnect from '@/lib/db';
import EnrollmentSurvey from '@/lib/models/EnrollmentSurvey';
import { getCurrentUser, unauthorized } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

const REQUIRED_TEXT = [
  'studentName', 'studentFullName', 'preferredName', 'grade', 'dateOfBirth',
  'schoolType', 'parentName', 'parentEmail', 'emergencyContact',
  'learningStyle', 'academicAreas', 'healthNotes', 'hobbies', 'referral',
];

// GET /api/family/survey: the signed-in family's submitted surveys (used by the
// profile page to show, per student, whether the enrollment form is done).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  await dbConnect();
  const surveys = await EnrollmentSurvey.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(50);
  return Response.json({ surveys });
}

// POST /api/family/survey: submit (or update) the enrollment survey for one
// student. One survey per student; siblings each submit their own.
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const clean = {};
  for (const k of REQUIRED_TEXT) {
    const v = body?.[k]?.toString().trim();
    if (!v) return Response.json({ error: `Missing required field: ${k}` }, { status: 400 });
    clean[k] = v.slice(0, 2000);
  }

  const homeLanguage = Array.isArray(body?.homeLanguage)
    ? body.homeLanguage.map((s) => s?.toString().trim()).filter(Boolean).slice(0, 5)
    : [];
  if (homeLanguage.length === 0) {
    return Response.json({ error: 'Missing required field: homeLanguage' }, { status: 400 });
  }

  if (body?.consentPersonalInfo !== true || body?.consentLiability !== true || body?.consentHandbook !== true) {
    return Response.json({ error: 'The required consents must be checked.' }, { status: 400 });
  }
  if (!['agree', 'decline'].includes(body?.mediaRelease)) {
    return Response.json({ error: 'Please answer the media release question.' }, { status: 400 });
  }

  await dbConnect();
  const doc = await EnrollmentSurvey.findOneAndUpdate(
    { userId: user._id, studentName: clean.studentName },
    {
      ...clean,
      homeLanguage,
      homeLanguageOther: (body?.homeLanguageOther || '').toString().trim().slice(0, 200),
      schoolTypeOther: (body?.schoolTypeOther || '').toString().trim().slice(0, 200),
      schoolDistrict: (body?.schoolDistrict || '').toString().trim().slice(0, 200),
      schoolDistrictOther: (body?.schoolDistrictOther || '').toString().trim().slice(0, 200),
      schoolName: (body?.schoolName || '').toString().trim().slice(0, 300),
      otherNotes: (body?.otherNotes || '').toString().trim().slice(0, 5000),
      consentPersonalInfo: true,
      consentLiability: true,
      consentHandbook: true,
      mediaRelease: body.mediaRelease,
      referralOther: (body?.referralOther || '').toString().trim().slice(0, 200),
      userId: user._id,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
  return Response.json({ ok: true, survey: doc });
}
