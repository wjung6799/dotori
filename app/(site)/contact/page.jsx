import ContactForm from './ContactForm';
import { getGlobal } from '@/lib/cms';

// Server wrapper: reads the editable heading from the CMS and hands it to the
// client form (form logic stays entirely in ContactForm).
export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const c = await getGlobal('contactPage');
  return <ContactForm heading={c.heading || 'Contact Us'} />;
}
