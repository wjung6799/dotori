// Single source of truth for tutoring prices. Surfaced in the family portal at
// /dashboard/credits, where parents buy session credits with a card. Render the
// marketing-style chart with components/PriceChart.jsx; the numeric fields below
// drive the actual payment math.
//
// The published rates are per HOUR, but a family's balance is counted in
// SESSIONS, so turning a rate into a charge needs a lesson length. That length
// is per package (see hoursForRate below), because the school does not have one:
// the small-group room runs two-hour sessions, Mrs. Jung's weekday 1:1 lessons
// are 60 minutes, and her Saturday blocks are 90. HOURS_PER_SESSION is only the
// fallback for a package that does not say.

// ── Fall Quarter 2026 ─────────────────────────────────────────────────
// The published schedule & tuition sheet, as data. Every quarter runs 12 weeks
// and every group class meets 12 times, which is what lets a quarter's tuition
// be one figure rather than a per-session rate.
export const TERM = {
  slug: 'fall-2026',
  label: 'Fall Quarter 2026',
  weeks: 12,
  sessionsPerClass: 12,
  placementTestBy: '2026-09-07', // new families only
  registrationOpens: '2026-09-07',
  // A spot is held this long and then released to the next family on the list.
  spotsHeldUntil: '2026-09-07',
  firstWeek: '2026-09-21',
  lastDay: '2026-12-13',
};

// Group class tuition for one quarter. `materialsFeeCents` is billed as its own
// line rather than folded into the price, so a family can see what the teaching
// costs and what the books cost; zero means materials are inside the tuition.
export const GROUP_CLASS_TUITION = [
  {
    id: 'core-literacy',
    name: 'Core Literacy',
    levels: 'Acorn · Sprout · Sapling · Oak',
    minutes: 80,
    sessions: 12,
    priceCents: 89500,
    materialsFeeCents: 0,
  },
  {
    id: 'book-club',
    name: 'Book Club',
    levels: 'Acorn · Sprout · Sapling · Oak',
    minutes: 80,
    sessions: 12,
    priceCents: 89500,
    materialsFeeCents: 0,
  },
  {
    id: 'korean-phonics',
    name: 'Korean Phonics (Hangeul)',
    levels: 'Level 3 · K–1',
    minutes: 80,
    sessions: 12,
    priceCents: 69500,
    materialsFeeCents: 3000,
  },
];

export function groupTuition(id) {
  return GROUP_CLASS_TUITION.find((t) => t.id === id) || null;
}

// ── Private & semi-private lessons ────────────────────────────────────
// Two formats and three package sizes. Every rate is per hour: hours are bought
// in advance and deducted as sessions are booked, and the rate is set by the
// size of the package, so the same lesson costs less inside a bigger commitment.
//
// These are the school's published figures. What a family is actually quoted
// comes from the instructor's own rates (Tutor.rates → packsForTutor), because
// credits are per instructor; this table is the source those rates are set from.
export const LESSON_FORMATS = [
  {
    id: 'private',
    name: '1:1 Private',
    students: 'One student',
    availability: 'Mon–Fri, 60 min · Sat, 90 min',
    // The weekday length, which is what a quarter of 1:1 is priced against.
    hoursPerSession: 1,
  },
  {
    id: 'semi-private',
    name: 'Semi-Private (2:1)',
    students: 'Two students',
    availability: 'Saturdays only, 90 min',
    hoursPerSession: 1.5,
  },
];

// Rows of the published package table. `hours` is the total bought at that size
// — a quarter of weekly 1:1 is twelve 60-minute lessons (12 hours), the same
// quarter of semi-private is twelve 90-minute lessons (18 hours).
export const LESSON_PACKAGES = [
  {
    id: 'single',
    name: 'Single session',
    blurb: 'Pay as you go',
    sessions: 1,
    validMonths: 3,
    rates: { private: { ratePerHour: 105, hours: 1 }, 'semi-private': { ratePerHour: 90, hours: 1.5 } },
  },
  {
    id: 'quarter',
    name: 'One quarter',
    blurb: '12 weeks of weekly lessons',
    sessions: 12,
    // Hours have to be used inside the term they cover.
    validMonths: 3,
    rates: { private: { ratePerHour: 90, hours: 12 }, 'semi-private': { ratePerHour: 75, hours: 18 } },
  },
  {
    id: 'three-quarters',
    name: 'Three quarters',
    blurb: 'Three 12-week quarters',
    sessions: 36,
    validMonths: 9,
    rates: { private: { ratePerHour: 80, hours: 36 }, 'semi-private': { ratePerHour: 65, hours: 54 } },
  },
];

// The page-2 terms, kept beside the numbers they govern so a policy change and
// a price change are the same edit.
export const LESSON_POLICY = [
  {
    q: 'Prepaid hours',
    a: 'Private lesson hours are purchased in advance. Each session you book online is deducted from your balance.',
  },
  {
    q: 'Using your hours',
    a: 'Hours must be used within the term they cover: one quarter, or three quarters for the larger package. Unused hours do not carry over, except in special circumstances arranged with Mrs. Jung.',
  },
  {
    q: 'Rescheduling',
    a: 'A booked session may be moved or cancelled up to 24 hours in advance at no cost.',
  },
  {
    q: 'Late cancellations',
    a: 'A session cancelled within 24 hours, or missed without notice, is deducted from your balance.',
  },
  {
    q: 'If your child is unwell',
    a: 'Illness is the exception. Let us know any time before the lesson begins, even on the same day, and the hour stays in your balance at no charge.',
  },
  {
    q: 'Refunds',
    a: 'Group classes and private lesson packages may be cancelled up to one week before the first session. Tuition is non-refundable after that date.',
  },
];

// How many billed hours one session is worth when a package does not say. The
// small-group room runs two-hour sessions; anything shorter sets its own length.
export const HOURS_PER_SESSION = 2;

// The billed length of one lesson in a package. Per package, not per school:
// Mrs. Jung's weekday 1:1 lessons are 60 minutes and her Saturday blocks are 90,
// and both sell alongside the two-hour small-group session.
export function hoursForRate(rate) {
  const h = Number(rate?.hoursPerSession);
  return Number.isFinite(h) && h > 0 ? h : HOURS_PER_SESSION;
}

// "60 min" / "90 min" / "2 hours" — whichever reads as the length a parent was
// told, rather than "1.5 hours".
export function lengthLabel(hours) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return '';
  if (h < 1 || !Number.isInteger(h)) return `${Math.round(h * 60)} min`;
  return h === 1 ? '1 hour' : `${h} hours`;
}

// Total hours in a package, for the "· 18 hours" line on a price card.
export function hoursLabel(hours) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return '';
  const n = Number.isInteger(h) ? h : Math.round(h * 10) / 10;
  return `${n} hour${n === 1 ? '' : 's'}`;
}

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
  // CARD SURCHARGE, by the owner's decision (2026-09-02): bank transfer (ACH)
  // joins the online channel at face value, and paying by card adds pct% for
  // processing. This replaces the August no-fee ruling. The obligations that
  // come with a surcharge are documented above — the debit-card exemption is
  // the binding one. The other modes stay documented because this has flipped
  // more than once.
  mode: 'card_surcharge',
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
  // Fixed per-product fees belong to the convenience-fee framing only. In the
  // percentage modes the adjustment comes from quoteFor(), so suggesting a
  // stored figure here would double-charge.
  if (PAYMENT_ADJUSTMENT.mode !== 'convenience_fee') return 0;
  const base = Math.max(0, Math.round(priceCents || 0));
  return Math.round((base * PAYMENT_ADJUSTMENT.feePct) / 100 / 100) * 100;
}

// Default expiry windows, in months, for the school-wide packages. Roughly a
// weekly cadence plus slack: a 10-session pack is ~2.5 months of lessons in a
// 6-month window. OWNER: adjust these — they are a policy choice, not a
// calculation, and the FAQ already promises one gracious extension.
const DEFAULT_VALID_MONTHS = { 1: 3, 10: 6, 40: 12 };

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
    // The school-wide list is the small-group product. A private rate is always
    // the tutor's own — there is no sensible default for it.
    sessionType: 'semi_private',
    validMonths: DEFAULT_VALID_MONTHS[sessions] ?? null,
  };
};

// When a package bought today stops being usable. null months = never lapses.
export function expiryFor(validMonths, from = new Date()) {
  if (!validMonths || validMonths < 1) return null;
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.round(validMonths));
  // Clamped so 31 Jan + 1 month lands on 28/29 Feb rather than skipping a month.
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

// Plain-English window for a package card: "Use within 6 months".
export function validityLabel(validMonths) {
  if (!validMonths || validMonths < 1) return 'No expiry';
  return validMonths === 1 ? 'Use within 1 month' : `Use within ${validMonths} months`;
}

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

// The id a family's purchase is resolved by. It has to be derived from every
// number that sets the price, not just the size: a 12-lesson 1:1 quarter and a
// 12-lesson semi-private quarter are both "12 sessions", and an id built from
// the size alone would let one redeem against the other's rate.
export function tutorPackId(sessions, ratePerHour, hours, sessionType = 'semi_private') {
  // The kind is part of the identity: the same size, rate and length can exist
  // for both semi-private and private, and resolving one id against the other
  // list is how a family gets charged the wrong product's price.
  const kind = sessionType === 'private' ? 'p' : 's';
  return `t${kind}${Math.round(sessions)}x${Math.round(ratePerHour * 100)}h${Math.round(hours * 10)}`;
}

// The packages one tutor sells. Rates differ per tutor, so this is what a family
// is shown once they have picked who they want to book. A tutor with no rates of
// their own falls back to the school-wide list, which keeps a newly added tutor
// sellable before anyone gets round to pricing them.
// `sessionType` narrows to one kind — semi-private or private — because they are
// separate products at separate rates. Omit it to get everything the tutor sells.
export function packsForTutor(tutor, sessionType = null) {
  const all = (tutor?.rates || []).filter((r) => r && r.sessions > 0 && r.ratePerHour >= 0);
  const rates = sessionType ? all.filter((r) => (r.sessionType || 'semi_private') === sessionType) : all;

  // Nothing priced for this kind: fall back to the school-wide list, but only
  // for semi-private. Private is a premium product — quoting the group rate for
  // it would undercharge, so an unpriced private offering simply is not sold.
  if (rates.length === 0) {
    if (sessionType === 'private') return [];
    return all.length === 0 ? CREDIT_PACKS : [];
  }

  return rates
    .slice()
    // Grouped by lesson length first, then by size. An instructor who sells two
    // formats (60-minute 1:1 and 90-minute semi-private) gets each one's ladder
    // read top to bottom instead of the two interleaved by session count.
    .sort((a, b) => hoursForRate(a) - hoursForRate(b) || a.sessions - b.sessions)
    .map((r) => {
      const sessions = Math.round(r.sessions);
      const hours = hoursForRate(r);
      const totalHours = hours * sessions;
      const amountCents = Math.round(r.ratePerHour * hours * sessions * 100);
      return {
        // Scoped to the tutor so a pack id can never be redeemed against someone
        // else's prices.
        id: tutorPackId(sessions, r.ratePerHour, hours, r.sessionType || 'semi_private'),
        // A stored name wins: "One quarter · 1:1 Private" is what the family was
        // quoted, and "12-Session Package" is only the fallback for a package
        // nobody bothered to name.
        name:
          (r.name || '').trim() ||
          (sessions === 1 ? 'Single session' : `${sessions}-Session Package`),
        sessions,
        hoursPerSession: hours,
        totalHours,
        ratePerHour: r.ratePerHour,
        amountCents,
        onlineFeeCents: PAYMENT_ADJUSTMENT.mode === 'none' ? 0 : defaultOnlineFeeCents(amountCents),
        tag: r.tag || '',
        highlight: false,
        sessionType: r.sessionType || 'semi_private',
        validMonths: r.validMonths ?? null,
        lines: [
          `${sessions} lesson${sessions === 1 ? '' : 's'} × ${lengthLabel(hours)}`,
          `$${r.ratePerHour}/hour · ${hoursLabel(totalHours)} in total`,
        ],
      };
    });
}

// Find a pack within one tutor's list. Never search the global list for a
// tutor purchase: that is how a family ends up charged another tutor's rate.
export function findTutorPack(tutor, packId) {
  return packsForTutor(tutor).find((p) => p.id === packId) || null;
}

// Which kinds this tutor actually sells right now. A family should not be shown
// a "Private" option by someone who has not priced one.
export function sessionTypesForTutor(tutor) {
  return ['semi_private', 'private'].filter((t) => packsForTutor(tutor, t).length > 0);
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
  // Outside the convenience-fee mode, a figure stored on an older class or
  // invoice must not keep charging — the switch has to win over the data.
  if (PAYMENT_ADJUSTMENT.mode !== 'convenience_fee') return 0;
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
// The payment methods the portal actually offers. ACH first: it is the
// fee-free option, so it is the default everywhere a family picks. (Under the
// old convenience-fee framing bank transfer had to stay out of the online
// channel; the surcharge framing is what lets it back in.)
export const ONLINE_METHODS = ['ach', 'card'];

export function savingsHint() {
  const { mode, pct } = PAYMENT_ADJUSTMENT;
  if (mode === 'none') return '';
  if (mode === 'convenience_fee') {
    return 'Paying by card online adds a fixed fee. To avoid it, pay by Zelle or check — just contact the school.';
  }
  return mode === 'ach_discount'
    ? `Save ${pct}% when you pay by bank transfer.`
    : `Bank transfer (ACH) costs nothing extra — a ${pct}% processing fee applies to card payments.`;
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
