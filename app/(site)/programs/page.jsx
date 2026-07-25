import { getPayload } from 'payload';
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html';
import config from '@payload-config';
import ProgramsClient from './ProgramsClient';

// Read the editable copy from the CMS (Payload global) at request time, so a
// staff edit in /cms shows up on refresh. The rich-text intro is converted to an
// HTML string HERE, on the server, so no Payload/lexical code reaches the client
// bundle. Falls back to the original hardcoded copy if the CMS is unavailable or
// the global hasn't been filled in yet.
export const dynamic = 'force-dynamic';

export default async function ProgramsPage() {
  let data = null;
  let introHtml = '';
  try {
    const payload = await getPayload({ config });
    data = await payload.findGlobal({ slug: 'programsPage' });
    if (data?.intro) introHtml = convertLexicalToHTML({ data: data.intro });
  } catch (err) {
    console.error('Programs CMS read failed, using fallback copy:', err);
  }

  return (
    <ProgramsClient
      heading={data?.heading || 'English Reading & Writing'}
      introHtml={introHtml}
      koreanTabLabel={data?.koreanTabLabel || 'Korean'}
    />
  );
}
