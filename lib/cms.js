import { getPayload } from 'payload';
import config from '@payload-config';

// Thin server-side helpers for reading CMS content in page.jsx server
// components. Payload returns field defaultValues for an unsaved global, so
// these return the real copy even before anyone edits it in /cms. On any error
// (e.g. CMS/db unavailable) they degrade to an empty object / list rather than
// throwing, so a page still renders.

let _payloadPromise;
function payload() {
  if (!_payloadPromise) _payloadPromise = getPayload({ config });
  return _payloadPromise;
}

export async function getGlobal(slug) {
  try {
    const p = await payload();
    return (await p.findGlobal({ slug })) || {};
  } catch (err) {
    console.error(`CMS getGlobal(${slug}) failed:`, err);
    return {};
  }
}

export async function getTeam({ homeOnly = false } = {}) {
  try {
    const p = await payload();
    const res = await p.find({
      collection: 'teamMembers',
      where: homeOnly ? { showOnHome: { equals: true } } : {},
      sort: 'order',
      limit: 50,
    });
    return res.docs || [];
  } catch (err) {
    console.error('CMS getTeam failed:', err);
    return [];
  }
}
