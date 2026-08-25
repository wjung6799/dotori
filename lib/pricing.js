// Single source of truth for tutoring prices. Surfaced in the family portal at
// /dashboard/credits, where parents buy session credits with a card. Render the
// marketing-style chart with components/PriceChart.jsx; the numeric fields below
// drive the actual payment math.
//
// !! OWNER CONFIRMATION NEEDED !!
// The published rates are per HOUR. Credits are per SESSION, so turning a rate
// into a charge needs a session length. HOURS_PER_SESSION below is taken from the
// "2-hour sessions" line in the Small-Group package. If tutoring sessions are not
// actually 2 hours, change that one constant and every pack price follows.

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

// How many billed hours one session credit is worth. See the note at the top of
// this file: every CREDIT_PACKS price is derived from this.
export const HOURS_PER_SESSION = 2;

const pack = (id, name, sessions, ratePerHour, tag, lines, highlight = false) => ({
  id,
  name,
  sessions,
  ratePerHour,
  // Cents is the unit Stripe charges in; keep the integer authoritative so no
  // float rounding can drift between what we display and what we capture.
  amountCents: Math.round(ratePerHour * HOURS_PER_SESSION * sessions * 100),
  tag,
  highlight,
  lines,
});

// Session-credit packs a family can buy with a card in the portal. One credit
// books one small-group slot; a private (whole-slot) booking spends two.
// Families who pay offline by Zelle are still granted credits by an admin, so
// this is an additional path, not a replacement.
export const CREDIT_PACKS = [
  pack('single', 'Single session', 1, 80, 'Drop-in', [
    'One small-group session',
    'Use it any time a seat is open',
  ]),
  pack('pack-10', '10-Session Package', 10, 70, 'Save $10/hr', [
    'Ten small-group sessions',
    'Best for a steady term',
    'Same instructor each session',
  ], true),
  pack('pack-40', '40-Session Package', 40, 60, 'Best value', [
    'Forty small-group sessions',
    'For a full school-year commitment',
    'Lowest rate we offer',
  ]),
];

export function findPack(id) {
  return CREDIT_PACKS.find((p) => p.id === id) || null;
}

export function formatUsd(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}


// ── How paying by card vs bank transfer changes the total ─────────────
//
// Same money either way; only the framing differs, and the framing has legal
// weight in the US:
//
//   'ach_discount'   — the invoice lists the CARD price and bank transfer earns
//                      a discount. A discount for a payment method is permitted
//                      in every state and needs no card-network registration.
//                      THIS IS THE ACTIVE MODE.
//
//   'card_surcharge' — the invoice lists the BANK price and card adds a fee.
//                      Card-network rules require registering the surcharge with
//                      the networks ~30 days ahead, exempting debit and prepaid
//                      cards, and disclosing it before checkout and on the
//                      receipt. Connecticut, Massachusetts and Puerto Rico ban
//                      it outright; Washington allows it with disclosure.
//
// Flipping the mode changes only what the family is shown; the arithmetic and
// every stored field below is shared.
export const PAYMENT_ADJUSTMENT = {
  mode: 'ach_discount',
  pct: 3,
};

// What one payment method costs, given the invoice subtotal. `adjustmentCents`
// is signed: negative is a discount, positive a surcharge.
export function quoteFor(subtotalCents, method) {
  const base = Math.max(0, Math.round(subtotalCents || 0));
  const { mode, pct } = PAYMENT_ADJUSTMENT;
  const delta = Math.round((base * pct) / 100);

  if (mode === 'ach_discount') {
    // Subtotal IS the card price; bank transfer comes off it.
    if (method === 'ach') {
      return {
        subtotalCents: base,
        adjustmentCents: -delta,
        adjustmentLabel: `Bank transfer discount (${pct}%)`,
        totalCents: base - delta,
      };
    }
    return { subtotalCents: base, adjustmentCents: 0, adjustmentLabel: '', totalCents: base };
  }

  // card_surcharge: subtotal is the bank price; card adds to it.
  if (method === 'card') {
    return {
      subtotalCents: base,
      adjustmentCents: delta,
      adjustmentLabel: `Card processing fee (${pct}%)`,
      totalCents: base + delta,
    };
  }
  return { subtotalCents: base, adjustmentCents: 0, adjustmentLabel: '', totalCents: base };
}

// The line the family sees next to the method picker, before they commit.
export function savingsHint() {
  const { mode, pct } = PAYMENT_ADJUSTMENT;
  return mode === 'ach_discount'
    ? `Save ${pct}% when you pay by bank transfer.`
    : `A ${pct}% processing fee applies to card payments.`;
}

export const PRICING_FAQ = [
  {
    q: 'What does “small-group” mean?',
    a: 'Classes stay small, and every student works on their own curriculum with the same instructor: genuine individual attention, not a one-size worksheet class.',
  },
  {
    q: 'Do packages expire?',
    a: 'Packages have an expiry window, but we’re gracious. If life gets in the way, just ask and we’ll extend it once. We’d always rather keep your child learning than watch a package lapse.',
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
