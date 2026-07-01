import Stripe from 'stripe';

// Lazily instantiate so importing this module never throws when the key is
// absent (e.g. during build); only actual calls require STRIPE_SECRET_KEY.
let _stripe = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set.');
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
