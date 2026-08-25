// Reports what a Stripe account is actually configured to do, so the setup
// questions (is it activated? what MCC? which webhooks exist?) get answered from
// the API instead of from support tickets.
//
//   node scripts/stripe-doctor.mjs
//
// Reads STRIPE_* from .env.local. Never prints a secret.
import Stripe from 'stripe';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
);

const key = env.STRIPE_SECRET_KEY;
if (!key) {
  console.log('STRIPE_SECRET_KEY is not in .env.local yet.');
  process.exit(1);
}

const mode = key.startsWith('sk_test_') ? 'TEST' : key.startsWith('sk_live_') ? 'LIVE' : 'UNKNOWN';
console.log(`mode                 ${mode}`);
console.log(`publishable key      ${env.STRIPE_PUBLISHABLE_KEY ? 'set (' + env.STRIPE_PUBLISHABLE_KEY.slice(0, 12) + '…)' : 'MISSING'}`);
console.log(`webhook secret       ${env.STRIPE_WEBHOOK_SECRET ? 'set' : 'MISSING — run: stripe listen --forward-to localhost:3000/api/payments/webhook'}`);
console.log('');

const stripe = new Stripe(key);

try {
  const a = await stripe.accounts.retrieve();
  console.log('── account ──────────────────────────────');
  console.log(`business name        ${a.business_profile?.name || a.settings?.dashboard?.display_name || '(unset)'}`);
  console.log(`country / currency   ${a.country} / ${a.default_currency?.toUpperCase()}`);
  console.log(`charges enabled      ${a.charges_enabled ? 'yes' : 'NO — account not activated for live payments'}`);
  console.log(`payouts enabled      ${a.payouts_enabled ? 'yes' : 'NO — add a bank account'}`);
  console.log(`MCC                  ${a.business_profile?.mcc || '(unset)'}   ← convenience fees depend on this`);
  console.log(`statement descriptor ${a.settings?.payments?.statement_descriptor || '(unset — parents will see something generic)'}`);
  const due = a.requirements?.currently_due || [];
  if (due.length) console.log(`still required       ${due.join(', ')}`);
} catch (err) {
  console.log('account lookup failed:', err.message);
}

console.log('');
console.log('── webhooks ─────────────────────────────');
const NEEDED = ['payment_intent.succeeded', 'payment_intent.processing', 'payment_intent.payment_failed'];
try {
  const { data } = await stripe.webhookEndpoints.list({ limit: 20 });
  if (!data.length) console.log('none configured');
  for (const w of data) {
    const missing = NEEDED.filter((e) => !w.enabled_events.includes(e) && !w.enabled_events.includes('*'));
    console.log(`${w.status.padEnd(8)} ${w.url}`);
    console.log(`         events: ${w.enabled_events.length > 6 ? w.enabled_events.length + ' subscribed' : w.enabled_events.join(', ')}`);
    if (missing.length) console.log(`         MISSING: ${missing.join(', ')}`);
  }
} catch (err) {
  console.log('webhook lookup failed:', err.message);
}

console.log('');
console.log('── payment methods enabled ──────────────');
try {
  const { data } = await stripe.paymentMethodConfigurations.list({ limit: 5 });
  for (const c of data) {
    const on = Object.entries(c)
      .filter(([, v]) => v && typeof v === 'object' && v.display_preference)
      .filter(([, v]) => v.display_preference.value !== 'off')
      .map(([k]) => k);
    console.log(`${c.name || c.id}: ${on.join(', ') || '(none)'}`);
  }
} catch (err) {
  console.log('(could not read payment method config:', err.message + ')');
}
