import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ScheduleBrowse from './ScheduleBrowse';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Schedule a Session | Dotori School',
  description:
    'Browse open tutoring times at Dotori School in Bellevue and book a session.',
};

// Public preview of open times, for families who have not signed up yet. Anyone
// already signed in is sent to the portal, where their credit balance and their
// standing weekly bookings live. Old confirmation emails link here, so the URL
// has to keep working for both.
export default async function SchedulePage() {
  const session = await auth();
  const role = session?.user?.role;
  if (session?.user) {
    if (role === 'admin') redirect('/admin/booking');
    if (role === 'tutor') redirect('/tutor');
    redirect('/dashboard/booking');
  }
  return <ScheduleBrowse />;
}
