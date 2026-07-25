import { getPayload } from 'payload';
import config from '@payload-config';

// Thin server-side helpers for reading CMS content in page.jsx server
// components. Payload returns field defaultValues for an unsaved global, so
// these return the real copy even before anyone edits it in /cms. On any error
// (e.g. CMS/db unavailable) they degrade to an empty object / list rather than
// throwing, so a page still renders.

let _payloadPromise;
function payload() {
  if (!_payloadPromise) {
    // If init rejects, clear the cache so the next request retries instead of
    // permanently serving the rejected promise.
    _payloadPromise = getPayload({ config }).catch((err) => {
      _payloadPromise = null;
      throw err;
    });
  }
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

export async function getPosts({ limit = 50 } = {}) {
  try {
    const p = await payload();
    const res = await p.find({
      collection: 'posts',
      where: { status: { equals: 'published' } },
      sort: '-publishedDate',
      depth: 1, // populate coverImage
      limit,
    });
    return res.docs || [];
  } catch (err) {
    console.error('CMS getPosts failed:', err);
    return [];
  }
}

export async function getPostBySlug(slug) {
  try {
    const p = await payload();
    const res = await p.find({
      collection: 'posts',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      depth: 1,
      limit: 1,
    });
    return res.docs?.[0] || null;
  } catch (err) {
    console.error(`CMS getPostBySlug(${slug}) failed:`, err);
    return null;
  }
}

export async function getTeam({ homeOnly = false } = {}) {
  try {
    const p = await payload();
    const res = await p.find({
      collection: 'teamMembers',
      where: homeOnly ? { showOnHome: { equals: true } } : {},
      sort: 'order',
      depth: 1, // populate the photo upload relationship (so photo.url is available)
      limit: 50,
    });
    return res.docs || [];
  } catch (err) {
    console.error('CMS getTeam failed:', err);
    return [];
  }
}
