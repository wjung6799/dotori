import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// The enrollment form moved into the portal, where adding a student now hands
// straight off to it. This URL is kept because it was linked from emails and
// from the old profile page; the ?student= name has to survive the hop or the
// form opens blank.
export default async function EnrollmentSurveyRedirect({ searchParams }) {
  const params = await searchParams;
  const student = typeof params?.student === 'string' ? params.student : '';
  redirect(
    student
      ? `/dashboard/students/enrollment-form?student=${encodeURIComponent(student)}`
      : '/dashboard/students',
  );
}
