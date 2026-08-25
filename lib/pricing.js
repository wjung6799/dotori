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

// ── How paying by card vs bank transfer changes the total ─────────────
//
// Same money to the school either way; the framing decides which rulebook
// applies, and in the US that matters:
//
//   'convenience_fee' — ACTIVE. A fixed fee for using the online card channel,
//       alongside a fee-free standard channel (Zelle, check). It needs no
//       card-network registration, no debit-card carve-out, and is not subject
//       to Washington's actual-cost cap on surcharges.
//
//       Four things have to stay true or it stops being a convenience fee and
//       becomes a surcharge, with all of that attached:
//         1. The account is an eligible merchant category. Confirmed: Stripe has
//            Dotori on MCC 8299, Educational Services — education is inside the
//            category where convenience fees are permitted.
//         2. The fee is a FIXED AMOUNT, never a percentage. It is stored per
//            class (Class.onlineFeeCents) and snapshotted onto each invoice.
//         3. The online channel offers ONLY card, so the fee applies to every
//            method available in it. Do not add bank transfer beside a card-only
//            fee; see ONLINE_METHODS below.
//         4. The school genuinely keeps taking Zelle and checks with no fee. If
//            online ever becomes the only way to pay, there is no "convenience"
//            being charged for and the whole basis collapses.
//
//   'card_surcharge' — a percentage added for paying by credit card. Requires
//       registering with the card networks ~30 days ahead, EXEMPTING debit and
//       prepaid cards (which means detecting card funding type before charging),
//       disclosure at checkout and on the receipt, and — under Washington's
//       RCW 19.360.030 — staying at or below actual processing cost. At Stripe's
//       2.9% + $0.30 a 3% surcharge stays under cost up to about $2,300, so the
//       cost cap is not the binding constraint; the debit exemption is.
//       Banned outright in Connecticut, Massachusetts and Puerto Rico.
//
//   'ach_discount' — the invoice lists the card price and bank transfer earns a
//       discount. Permitted everywhere with no registration and no debit
//       carve-out, because a discount is not a fee.
//
// Everything downstream reads quoteFor(), so switching modes changes only what
// families are shown and charged — no migration, no schema change.
export const PAYMENT_ADJUSTMENT = {
  // OFF, by the owner's decision: families pay the tuition figure and nothing
  // else, and the school absorbs what the card costs to process. The other modes
  // stay documented above because this has flipped more than once; turning one
  // back on is a one-word change here and needs nothing else touched.
  mode: 'none',
  // Used by the two percentage modes only.
  pct: 3,
  // Card is the ONLY method the online channel accepts, which is what keeps this
  // a convenience fee rather than a card surcharge: the fee is charged for using
  // the online channel, and it applies to every method available in it. Adding a
  // second online method (bank transfer) without also charging it the fee would
  // turn this back into a surcharge, with the registration, debit-card exemption
  // and Washington cost cap that come with one.
  feeAppliesTo: ['card'],
  // Fixed fees by invoice size, because a convenience fee cannot be a rate.
  // Bands approximate 3% at the middle of each range; a flat single fee would be
  // punitive on a small invoice and trivial on a large one. `uptoCents: null`
  // marks the final, open-ended band. EDIT THESE to taste — they are the whole
  // policy.
  // The default rate used to SUGGEST a fee when a new class is priced. The fee
  // that actually gets charged is a fixed dollar figure stored on the class
  // (Class.onlineFeeCents) and snapshotted onto the invoice, so what a family
  // pays is a set amount for that product, not a percentage of their basket.
  // That is what keeps it a convenience fee rather than a rate in disguise.
  feePct: 3,
};

// Suggested fee for a class at this price — 3%, rounded to the nearest dollar so
// the published figure is a round number rather than $12.36.
export function defaultOnlineFeeCents(priceCents) {
  if (PAYMENT_ADJUSTMENT.mode === 'none') return 0;
  const base = Math.max(0, Math.round(priceCents || 0));
  return Math.round((base * PAYMENT_ADJUSTMENT.feePct) / 100 / 100) * 100;
}

const pack = (id, name, sessions, ratePerHour, tag, lines, highlight = false, onlineFeeCents = null) => {
  // Cents is the unit Stripe charges in; keep the integer authoritative so no
  // float rounding can drift between what we display and what we capture.
  const amountCents = Math.round(ratePerHour * HOURS_PER_SESSION * sessions * 100);
  return {
    id,
    name,
    sessions,
    ratePerHour,
    amountCents,
    // Same convenience fee as a class: a fixed amount per product for using the
    // online card channel. Packs are the largest transactions the school takes —
    // a 40-session pack costs about $140 to process — so leaving them out would
    // quietly hand back most of what the fee recovers. Pass 0 to sell a pack
    // without one.
    // Follows the same switch: zero while fees are off.
    onlineFeeCents:
      PAYMENT_ADJUSTMENT.mode === 'none'
        ? 0
        : onlineFeeCents === null
          ? defaultOnlineFeeCents(amountCents)
          : onlineFeeCents,
    tag,
    highlight,
    lines,
  };
};

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


// The fee to charge. A stored figure always wins; the 3% suggestion is only a
// fallback for anything billed before a fee was set on its product.
export function convenienceFeeFor(subtotalCents, storedFeeCents) {
  // With fees off, a figure stored on an older class or invoice must not keep
  // charging — the switch has to win over the data.
  if (PAYMENT_ADJUSTMENT.mode === 'none') return 0;
  if (storedFeeCents !== null && storedFeeCents !== undefined && storedFeeCents !== '') {
    return Math.max(0, Math.round(storedFeeCents));
  }
  return defaultOnlineFeeCents(subtotalCents);
}

// What one payment method costs, given the invoice subtotal. `adjustmentCents`
// is signed: negative is a discount, positive a fee.
export function quoteFor(subtotalCents, method, storedFeeCents = null) {
  const base = Math.max(0, Math.round(subtotalCents || 0));
  const { mode, pct } = PAYMENT_ADJUSTMENT;
  const none = { subtotalCents: base, adjustmentCents: 0, adjustmentLabel: '', totalCents: base };

  if (mode === 'none') return none;

  if (mode === 'convenience_fee') {
    if (!PAYMENT_ADJUSTMENT.feeAppliesTo.includes(method)) return none;
    const fee = convenienceFeeFor(base, storedFeeCents);
    return {
      subtotalCents: base,
      adjustmentCents: fee,
      adjustmentLabel: 'Online payment fee',
      totalCents: base + fee,
    };
  }

  const delta = Math.round((base * pct) / 100);

  if (mode === 'ach_discount') {
    // Subtotal IS the card price; bank transfer comes off it.
    if (method !== 'ach') return none;
    return {
      subtotalCents: base,
      adjustmentCents: -delta,
      adjustmentLabel: `Bank transfer discount (${pct}%)`,
      totalCents: base - delta,
    };
  }

  // card_surcharge: subtotal is the bank price; card adds to it.
  if (method !== 'card') return none;
  return {
    subtotalCents: base,
    adjustmentCents: delta,
    adjustmentLabel: `Card processing fee (${pct}%)`,
    totalCents: base + delta,
  };
}

// The line the family sees next to the method picker, before they commit.
// The payment methods the portal actually offers. Bank transfer was dropped:
// offering it alongside a card-only fee would have made the fee a surcharge, and
// families who want to avoid the fee already have Zelle and checks.
export const ONLINE_METHODS = ['card'];

export function savingsHint() {
  const { mode, pct } = PAYMENT_ADJUSTMENT;
  if (mode === 'none') return '';
  if (mode === 'convenience_fee') {
    return 'Paying by card online adds a fixed fee. To avoid it, pay by Zelle or check — just contact the school.';
  }
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
