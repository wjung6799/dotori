// POC seed: create the first CMS admin user (if none) and fill the Programs
// global with the current copy, plus a visible sentinel so we can confirm the
// public page is reading from the CMS rather than the hardcoded fallback.
// Run with: npx payload run ./scripts/seed-cms.ts
import { getPayload } from 'payload';
import config from '@payload-config';

const bold = (text: string) => ({
  detail: 0, format: 1, mode: 'normal', style: '', text, type: 'text', version: 1,
});
const plain = (text: string) => ({
  detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1,
});

const intro = {
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: [
      {
        type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
        children: [
          plain('Dotori’s Language track is built around '),
          bold('English reading and writing'),
          plain(' — strong literacy is the heart of everything we do, from early readers to confident writers. For families who also want to keep the Korean language alive, we offer '),
          bold('Korean classes on the side'),
          plain('. Every class is small-group, with a personalized lesson plan for each student. This copy is now managed in the CMS.'),
        ],
      },
    ],
  },
};

const seed = async () => {
  const payload = await getPayload({ config });

  const existing = await payload.count({ collection: 'users' });
  if (existing.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: { email: 'admin@dotorischool.org', password: 'ChangeMe123!', name: 'Dotori Admin' },
    });
    payload.logger.info('Created first CMS user admin@dotorischool.org');
  } else {
    payload.logger.info(`Users already exist (${existing.totalDocs}); skipping user creation.`);
  }

  await payload.updateGlobal({
    slug: 'programsPage',
    data: {
      heading: 'English Reading & Writing',
      intro,
      koreanTabLabel: 'Korean',
    },
  });
  payload.logger.info('Seeded programsPage global.');

  process.exit(0);
};

seed();
