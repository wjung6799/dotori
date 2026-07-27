// Single source of truth for tutoring prices. Intentionally NOT on a public
// route right now — the plan is to surface this in the family dashboard when
// parents go to pay. Render it with components/PriceChart.jsx, and use the
// numeric ratePerHour fields for any future payment math.

export const SEMI_PRIVATE_PACKAGES = [
  {
    id: 'small-group',
    name: 'Small-Group',
    ratePerHour: 80,
    price: '$80',
    unit: '/hour',
    tag: 'Most families',
    highlight: true,
    lines: [
      'Personalized small-group sessions',
      '2-hour sessions',
      'Every student on their own plan',
      'Same instructor each session',
    ],
  },
  {
    id: 'pack-10',
    name: '10-Session Package',
    ratePerHour: 70,
    price: '$70',
    unit: '/hour',
    tag: 'Save $10/hr',
    lines: [
      'Personalized small-group sessions',
      'Billed as a 10-session package',
      'Best for a steady term',
      'Payment plans available',
    ],
  },
  {
    id: 'pack-40',
    name: '40-Session Package',
    ratePerHour: 60,
    price: '$60',
    unit: '/hour',
    tag: 'Best value',
    lines: [
      'Personalized small-group sessions',
      'Billed as a 40-session package',
      'For a full school-year commitment',
      'Payment plans available',
    ],
  },
];

export const PRIVATE_RATE = {
  id: 'private-1-1',
  name: 'Private 1:1 tutoring',
  ratePerHour: 150,
  price: '$150',
  unit: '/hr',
  availability: 'Saturdays only',
  blurb:
    'One-on-one, fully dedicated instruction. Most families find the small-group room gives their child plenty of individual attention at a better rate, but private is there when you want it.',
};

export const PRICING_FAQ = [
  {
    q: 'What does “small-group” mean?',
    a: 'Classes stay small, and every student works on their own curriculum with the same instructor — genuine individual attention, not a one-size worksheet class.',
  },
  {
    q: 'Do packages expire?',
    a: 'Packages have an expiry window, but we’re gracious — if life gets in the way, just ask and we’ll extend it once. We’d always rather keep your child learning than watch a package lapse.',
  },
  {
    q: 'Are payment plans available?',
    a: 'Yes. Rather than a large up-front prepayment, we can set up a school-year weekly slot at the best rate, billed monthly. Ask us at your diagnostic and we’ll find something that works.',
  },
  {
    q: 'How do we get started?',
    a: 'Every family begins with a free diagnostic assessment so we build the right plan before anyone pays for a session.',
  },
];
