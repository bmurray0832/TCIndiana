import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured, appOrigin, grossUpForFees } from "@/lib/stripe";

export const runtime = "nodejs";

/** Above this, a typo or a stolen-card test is likelier than a gift;
 *  large gifts go through staff. */
const MAX_ONLINE_GIFT = 50_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return new NextResponse("Stripe not configured", { status: 503 });
  }
  const stripe = getStripe()!;

  const form = await request.formData();
  const centerSlug = String(form.get("centerSlug") ?? "");
  const amountStr = String(form.get("amount") ?? "0");
  const frequency = String(form.get("frequency") ?? "ONE_TIME");
  const email = String(form.get("email") ?? "");
  const firstName = String(form.get("firstName") ?? "");
  const lastName = String(form.get("lastName") ?? "");
  const campaignId = String(form.get("campaignId") ?? "");
  const tribute = String(form.get("tribute") ?? "");
  const coverFees = form.get("coverFees") === "on";

  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount < 1) {
    return new NextResponse("Enter an amount of at least $1.", { status: 400 });
  }
  if (amount > MAX_ONLINE_GIFT) {
    return new NextResponse(
      `Online gifts are limited to $${MAX_ONLINE_GIFT.toLocaleString("en-US")}. Please contact us to arrange a larger gift.`,
      { status: 400 },
    );
  }
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
    return new NextResponse("Please enter your first and last name.", { status: 400 });
  }
  if (!EMAIL.test(email) || email.length > 254) {
    return new NextResponse("Please enter a valid email address.", { status: 400 });
  }
  if (frequency !== "ONE_TIME" && frequency !== "MONTHLY") {
    return new NextResponse("Choose one-time or monthly.", { status: 400 });
  }

  const center = await prisma.center.findFirst({
    where: { OR: [{ donationPageSlug: centerSlug }, { slug: centerSlug }] },
    include: { organization: true },
  });
  if (!center) return new NextResponse("Unknown center", { status: 404 });

  if (campaignId) {
    const c = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!c || c.organizationId !== center.organizationId) {
      return new NextResponse("Unknown campaign", { status: 400 });
    }
  }

  const baseCents = Math.round(amount * 100);
  const chargeCents = coverFees ? grossUpForFees(baseCents) : baseCents;

  const origin = appOrigin();
  const successUrl = `${origin}/give/thank-you?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/give/${centerSlug}`;

  const metadata: Record<string, string> = {
    centerId: center.id,
    centerSlug,
    organizationId: center.organizationId,
    firstName,
    lastName,
    intendedAmount: String(baseCents),
    coverFees: coverFees ? "1" : "0",
    frequency,
  };
  if (campaignId) metadata.campaignId = campaignId;
  if (tribute) metadata.tribute = tribute.slice(0, 500);

  const productName =
    `Gift to ${center.name}` +
    (frequency === "MONTHLY" ? " (monthly)" : "");

  if (frequency === "MONTHLY") {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            product_data: { name: productName },
            unit_amount: chargeCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: { metadata },
    });
    return NextResponse.json({ url: session.url });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    payment_method_types: ["card", "us_bank_account"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: productName },
          unit_amount: chargeCents,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    payment_intent_data: { metadata },
  });
  return NextResponse.json({ url: session.url });
}
