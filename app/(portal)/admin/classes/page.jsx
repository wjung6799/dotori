import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-helpers';
import { LITERACY_SLOTS } from '@/lib/literacySlots';
import CatalogEditor from './CatalogEditor';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Class catalog' };

// The class catalog is where a term actually gets built: names, schedules and —
// the part that matters for the family portal — prices. A class left at $0
// cannot be paid for online (Stripe rejects anything under 50 cents), so the
// editor calls that out rather than letting it pass silently.
export default async function AdminClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/admin/classes');
  if (user.role !== 'admin') redirect('/dashboard');

  return <CatalogEditor literacySlots={LITERACY_SLOTS} />;
}
