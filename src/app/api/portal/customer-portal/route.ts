import { NextResponse } from "next/server";
import { getPortalPerson } from "@/lib/portal-auth";
import { appOrigin, getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST() {
  if (!isStripeConfigured()) {
    return new NextResponse("Stripe not configured", { status: 503 });
  }
  const person = await getPortalPerson();
  if (!person) return new NextResponse("Not signed in", { status: 401 });
  if (!person.stripeCustomerId) {
    return new NextResponse("No Stripe customer on file — make an online gift first.", { status: 400 });
  }

  const stripe = getStripe()!;
  const session = await stripe.billingPortal.sessions.create({
    customer: person.stripeCustomerId,
    return_url: `${appOrigin()}/portal`,
  });
  return NextResponse.redirect(session.url, { status: 303 });
}
