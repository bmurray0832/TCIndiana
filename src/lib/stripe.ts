import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (_stripe) return _stripe;
  // Use the SDK's pinned default API version.
  _stripe = new Stripe(key);
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

export function appOrigin(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

/** Stripe fee estimator: 2.9% + $0.30 for cards. Used for the
 *  donor-covers-fees toggle so the amount we charge nets out close to
 *  the intended gift. Not exact — Stripe's true fees can vary by card
 *  type — but right within a few cents. */
export function grossUpForFees(intendedCents: number): number {
  // gross = (intended + 30) / (1 - 0.029)
  return Math.ceil((intendedCents + 30) / (1 - 0.029));
}
