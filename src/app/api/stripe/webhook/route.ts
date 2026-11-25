import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe webhook. Verifies the signature, then hands the event to
 *  lib/stripe-webhook.ts. A handler failure returns 500 so Stripe
 *  retries; every handler is safe to run twice.
 *
 *  Events to enable on the endpoint: checkout.session.completed,
 *  checkout.session.async_payment_succeeded, invoice.paid,
 *  invoice.payment_failed, customer.subscription.deleted,
 *  charge.refunded, charge.updated.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) return new NextResponse("Stripe not configured", { status: 503 });
  const stripe = getStripe()!;
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), sig, secret);
  } catch {
    return new NextResponse("Bad signature", { status: 400 });
  }

  try {
    await handleStripeEvent(stripe, event);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        source: "stripe-webhook",
        eventId: event.id,
        type: event.type,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return new NextResponse("Handler error", { status: 500 });
  }
  return NextResponse.json({ received: true });
}
