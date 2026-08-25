import { permanentRedirect } from 'next/navigation';

// The family profile moved into the portal, where it is split across
// /dashboard/account (contact details), /dashboard/students and
// /dashboard/reports. Older confirmation emails still link here.
export default function ProfilePage() {
  permanentRedirect('/dashboard/account');
}
