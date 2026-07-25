import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig } from 'payload';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import sharp from 'sharp';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Small helpers to keep the many text fields terse. Most page copy is plain
// text/textarea with a defaultValue = the current hardcoded string, so an
// unsaved global still returns the real copy (Payload applies field defaults)
// and the public pages render unchanged until staff edit them.
const text = (name: string, defaultValue: string, label?: string) => ({
  name, type: 'text' as const, defaultValue, ...(label ? { label } : {}),
});
const area = (name: string, defaultValue: string, label?: string) => ({
  name, type: 'textarea' as const, defaultValue, ...(label ? { label } : {}),
});

// Payload CMS. Embedded in the Next.js app, isolated in its own database.
// Routes are remapped off the defaults because the app already owns /admin:
//   admin UI  -> /cms       (app/(payload)/cms/...)
//   REST/GQL  -> /cms-api   (app/(payload)/cms-api/...)
export default buildConfig({
  admin: {
    user: 'users',
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: '· Dotori CMS' },
  },

  routes: { admin: '/cms', api: '/cms-api' },

  editor: lexicalEditor(),

  collections: [
    // Staff logins for the CMS.
    {
      slug: 'users',
      auth: true,
      admin: { useAsTitle: 'email' },
      fields: [{ name: 'name', type: 'text' }],
    },
    // Uploadable images — the media library staff drop photos into.
    {
      slug: 'media',
      upload: true,
      admin: { useAsTitle: 'filename' },
      fields: [{ name: 'alt', type: 'text', label: 'Alt text (for accessibility)' }],
    },
    // Reusable people. The founders appear on Home, About and Team, so they're
    // edited once here. Each page renders the slice it needs (home blurb, the
    // About narrative, or the structured Team details).
    {
      slug: 'teamMembers',
      labels: { singular: 'Team Member', plural: 'Team Members' },
      admin: { useAsTitle: 'name', defaultColumns: ['name', 'role', 'order'] },
      fields: [
        text('name', ''),
        text('honorific', '', 'Honorific (e.g. "(Mrs. Jung)")'),
        text('role', '', 'Role / title'),
        text('photoUrl', '', 'Photo URL (path under /public, e.g. /assets/images/…)'),
        text('imgPosition', 'center', 'Photo object-position (CSS, e.g. "center 18%")'),
        text('email', ''),
        area('homeBlurb', '', 'Short bio shown in the Home "founders" section'),
        area('aboutNarrative', '', 'First-person narrative shown on the About page (optional)'),
        {
          name: 'details',
          type: 'array',
          label: 'Structured bio (shown on the Team page)',
          labels: { singular: 'Detail', plural: 'Details' },
          fields: [text('label', '', 'Label (e.g. "Education")'), area('value', '', 'Value')],
        },
        { name: 'order', type: 'number', defaultValue: 0, admin: { description: 'Lower shows first.' } },
        { name: 'showOnHome', type: 'checkbox', defaultValue: true, label: 'Feature in the Home founders section' },
      ],
    },
  ],

  globals: [
    // ---- Programs page (built earlier). ----
    {
      slug: 'programsPage',
      label: 'Programs Page',
      admin: { description: 'Copy shown on the public Programs page.' },
      fields: [
        text('heading', 'English Reading & Writing'),
        { name: 'intro', type: 'richText', label: 'Intro paragraph' },
        text('koreanTabLabel', 'Korean', 'Korean tab label'),
        {
          name: 'programs',
          type: 'array',
          label: 'Program cards',
          admin: { description: 'Each card. "Category" controls which tab it shows under.' },
          fields: [
            {
              name: 'category',
              type: 'select',
              required: true,
              options: [
                { label: 'Reading', value: 'reading' },
                { label: 'Writing', value: 'writing' },
                { label: 'Korean', value: 'creative' },
                { label: '1:1', value: 'tutor' },
                { label: 'Summer Camp', value: 'summer' },
              ],
            },
            text('title', ''),
            text('duration', '', 'Duration line (optional)'),
            text('scheduleTitle', 'Class Schedule', 'Schedule heading (optional)'),
            area('schedule', '', 'Schedule lines — one per line, emoji ok (optional)'),
            {
              name: 'features',
              type: 'array',
              label: 'Bullet points (used by the 1:1 card)',
              fields: [area('text', '')],
            },
            {
              name: 'ctas',
              type: 'array',
              label: 'Buttons',
              fields: [
                text('label', ''),
                text('href', '', 'Link or file path (e.g. /assets/pdf/…)'),
                { name: 'style', type: 'select', defaultValue: 'primary', options: ['primary', 'secondary'] },
                { name: 'download', type: 'checkbox', defaultValue: false, label: 'Download file (vs open link)' },
              ],
            },
            text('curriculumHeading', '', 'Curriculum section heading (optional)'),
            {
              name: 'curriculumLinks',
              type: 'array',
              label: 'Curriculum PDF buttons',
              fields: [text('label', ''), text('href', '')],
            },
          ],
        },
      ],
    },

    // ---- Home page. ----
    {
      slug: 'homePage',
      label: 'Home Page',
      admin: { description: 'Copy on the landing page.' },
      fields: [
        text('heroHeading', 'Better grades. Higher scores. Real confidence.'),
        text('heroSubtitle', 'Personalized language & math — a lesson plan built for each student.'),
        text('heroSubtitle2', 'Personalized tutoring in Bellevue — a lesson plan built around your child, in small groups.'),
        text('heroCtaText', 'Book a Free Diagnostic Assessment'),
        area('seasonalBanner', 'Fall enrollment is open — placement tests, AMC, and finals are on the way.', 'Seasonal banner (update each season)'),
        text('languageTitle', 'Language'),
        area('languageBody', 'English reading & writing and Korean — warm, small-group instruction that grows readers, writers, and confident bilingual learners.'),
        text('mathTitle', 'Math & Test Prep'),
        area('mathBody', 'School math, test prep, AMC competition math, physics, and coding — real understanding that shows up in grades and scores.'),
        {
          name: 'trustItems',
          type: 'array',
          label: 'Trust band',
          fields: [text('title', ''), area('body', '')],
          defaultValue: [
            { title: 'Small groups', body: 'Personal attention in small classes — never a crowded worksheet room.' },
            { title: 'A plan for each student', body: 'Every child follows their own curriculum with the same instructor.' },
            { title: 'Credentialed teachers', body: 'A National Board Certified educator and a UW-trained STEM instructor.' },
            { title: 'Free diagnostic first', body: 'We show you where your child stands before you commit to anything.' },
          ],
        },
        text('foundersHeading', 'Meet the founders'),
        text('closingHeading', 'Start with a free diagnostic'),
        area('closingBody', '30–45 minutes, a clear picture of where your child stands, and a concrete plan. No obligation.'),
        text('closingCtaText', 'Book a Free Diagnostic Assessment'),
      ],
    },

    // ---- About page. ----
    {
      slug: 'aboutPage',
      label: 'About Page',
      fields: [
        text('idealForHeading', 'Dotori School is ideal for'),
        {
          name: 'idealForItems',
          type: 'array',
          label: 'Ideal-for list',
          fields: [area('text', '')],
          defaultValue: [
            { text: 'Students who require a solid foundation in English reading and writing skills' },
            { text: 'Students who benefit from personalized, small-group instruction' },
            { text: 'Students who are new to English and benefit from structured language development' },
            { text: 'English–Korean bilingual learners seeking strong literacy support' },
            { text: 'Students who want to learn Korean in an engaging and enjoyable way' },
            { text: 'Students building academic confidence in communication and classroom participation' },
            { text: 'Families looking for high-quality, in-person afterschool enrichment in the Redmond/Bellevue area' },
          ],
        },
        text('coreValuesHeading', 'Our Core Values'),
        text('founderHeading', 'Meet the Founder'),
        area('founderCtaBody', 'Discover how Dotori can help your child thrive in reading and writing. The best first step is a free diagnostic assessment — we’ll show you exactly where your child stands and build the right plan.'),
        text('ctaText', 'Book a Free Diagnostic Assessment'),
      ],
    },

    // ---- Team page (members come from the Team Members collection). ----
    {
      slug: 'teamPage',
      label: 'Team Page',
      fields: [text('heading', 'Meet Our Team')],
    },

    // ---- Math & Test Prep page. ----
    {
      slug: 'mathPage',
      label: 'Math Page',
      fields: [
        text('heading', 'Math & Test Prep'),
        area('intro', 'Better grades and higher scores, built on real understanding. Personalized tutoring in small groups, every student on their own plan — with the same instructor every session.'),
        text('ctaText', 'Book a Free Diagnostic Assessment'),
        text('notWorksheetHeading', 'Not a worksheet center'),
        area('notWorksheetBody', 'We don’t hand out packets and walk away. Every student follows their own curriculum, with the same instructor, getting genuine one-on-one minutes inside a small group. The plan is built for your child — after we’ve seen exactly where they stand.'),
        area('instructorNote', 'Instruction from Won Jung — B.S. Physics (UW), former engineer at Meta, Microsoft & Boeing, 15+ years tutoring, with a 100% record of students placed at top-30 universities.'),
        {
          name: 'programs',
          type: 'array',
          label: 'Programs',
          fields: [
            text('title', ''),
            text('tag', 'Badge'),
            text('duration', ''),
            { name: 'lead', type: 'checkbox', defaultValue: false, label: 'Highlight (lead card)' },
            { name: 'features', type: 'array', fields: [area('text', '')] },
          ],
          defaultValue: [
            { title: 'School Math & Test Prep', tag: 'Start here', lead: true, duration: 'Grade-level math through pre-calculus · SAT / placement prep', features: [
              { text: 'Built around your child’s actual class and where they’re headed' },
              { text: 'Placement-test and HiCap prep, mapped to district windows' },
              { text: 'SAT / standardized-test math when the time comes' },
              { text: 'Every student on their own curriculum inside a max-4 room' },
            ] },
            { title: 'AMC & Competition Math', tag: 'Our specialty', lead: false, duration: 'AMC 8 · AMC 10/12 · problem-solving foundations', features: [
              { text: 'Genuine competition training, not extra worksheets' },
              { text: 'AMC 8 (January) and AMC 10/12 (November) preparation' },
              { text: 'Builds the deep problem-solving that also lifts school math' },
              { text: 'For motivated students ready to stretch' },
            ] },
            { title: 'Physics', tag: 'High school & AP', lead: false, duration: 'Conceptual through AP Physics', features: [
              { text: 'Taught by a UW physics graduate and 15+ year tutor' },
              { text: 'Concept-first, then the problem-solving that earns the grade' },
              { text: 'Honors and AP Physics support' },
              { text: 'Great pairing with upper-level math' },
            ] },
            { title: 'Coding (Python)', tag: 'Foundations', lead: false, duration: 'Python fundamentals · logic & problem-solving', features: [
              { text: 'Real programming fundamentals in Python' },
              { text: 'Logical thinking that carries back into math' },
              { text: 'Project-based and paced to the student' },
              { text: 'A strong on-ramp before more advanced CS' },
            ] },
          ],
        },
        text('calendarHeading', 'Key dates we prep for'),
        {
          name: 'calendar',
          type: 'array',
          label: 'Key dates',
          fields: [text('label', ''), text('when', '')],
          defaultValue: [
            { label: 'Placement & HiCap testing', when: 'Fall & winter district windows — we prep on the right timeline' },
            { label: 'AMC 10/12', when: 'Early November' },
            { label: 'AMC 8', when: 'January' },
            { label: 'School finals', when: 'December & June — targeted review before each' },
            { label: 'SAT test dates', when: 'Aug, Oct, Nov, Dec, Mar, May, Jun' },
          ],
        },
        area('homeschoolNote', 'Daytime sessions available for homeschooling families. Upper-level math, physics, and competition prep during the 9am–3pm day.'),
        area('bottomCtaBody', 'Every student starts with a diagnostic, so we build the right plan from day one.'),
        text('bottomCtaText', 'Book a Free Diagnostic Assessment'),
      ],
    },

    // ---- Contact page (form logic stays in code; only wording is editable). ----
    {
      slug: 'contactPage',
      label: 'Contact Page',
      fields: [text('heading', 'Contact Us')],
    },

    // ---- Diagnostic page. ----
    {
      slug: 'diagnosticPage',
      label: 'Diagnostic Page',
      fields: [
        text('heading', 'Book a Free Diagnostic Assessment'),
        area('intro', 'Every Dotori student starts here. In one short session we show you exactly where your child stands and build the right plan — personalized, in small groups, each on their own path.'),
        {
          name: 'steps',
          type: 'array',
          label: 'How it works',
          fields: [text('n', ''), text('title', ''), area('body', '')],
          defaultValue: [
            { n: '1', title: '30–45 minute assessment', body: 'Your child works through a short, friendly assessment with one of our teachers — reading and writing, or math, depending on the focus.' },
            { n: '2', title: 'Parent debrief', body: 'We sit down with you and show exactly where your child stands today — strengths, gaps, and what’s coming next for their grade.' },
            { n: '3', title: 'A concrete plan', body: 'You leave with a specific plan and a target: what we’d work on, in what order, and how we’d measure progress. No obligation.' },
          ],
        },
      ],
    },
  ],

  // Isolate ALL Payload collections in their own database (dotori_cms), so
  // Payload never touches the app's production collections (the app's Mongoose
  // `User` model also uses `users`).
  db: mongooseAdapter({
    url: process.env.MONGODB_URI || '',
    connectOptions: { dbName: 'dotori_cms' },
  }),

  secret: process.env.PAYLOAD_SECRET || '',

  sharp,

  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
});
