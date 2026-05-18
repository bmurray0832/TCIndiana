import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { recomputePerson } from "@/lib/recompute";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isStripeConfigured()) return new NextResponse("Stripe not configured", { status: 503 });
  const stripe = getStripe()!;
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("Missing signature", { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return new NextResponse(`Bad signature: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment") {
          await handlePaymentSession(stripe, session);
        }
        // Subscription mode is handled via invoice.payment_succeeded so
        // each recurring charge produces its own Donation row.
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(stripe, invoice);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }
      default:
        // Other events are ignored for now.
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return new NextResponse("Handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type ParsedMetadata = {
  centerId?: string;
  organizationId?: string;
  campaignId?: string;
  firstName?: string;
  lastName?: string;
  intendedAmount?: string;
  coverFees?: string;
  tribute?: string;
};

async function findOrCreatePerson(
  centerId: string,
  email: string | null | undefined,
  firstName: string,
  lastName: string,
  stripeCustomerId: string | null,
) {
  if (stripeCustomerId) {
    const byStripe = await prisma.person.findUnique({ where: { stripeCustomerId } });
    if (byStripe) return byStripe;
  }
  if (email) {
    const byEmail = await prisma.person.findFirst({ where: { email, centerId } });
    if (byEmail) {
      if (stripeCustomerId && !byEmail.stripeCustomerId) {
        return prisma.person.update({
          where: { id: byEmail.id },
          data: { stripeCustomerId },
        });
      }
      return byEmail;
    }
  }
  return prisma.person.create({
    data: {
      centerId,
      firstName: firstName || "Anonymous",
      lastName: lastName || "Donor",
      email: email ?? null,
      source: "ONLINE",
      stripeCustomerId,
      convertedToDonorAt: new Date(),
      donorStatus: "ACTIVE",
    },
  });
}

async function handlePaymentSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (!session.payment_intent || typeof session.payment_intent !== "string") return;
  const intent = await stripe.paymentIntents.retrieve(session.payment_intent, {
    expand: ["charges.data.balance_transaction"],
  });
  const charge = (intent as Stripe.PaymentIntent & {
    charges?: { data: (Stripe.Charge & { balance_transaction?: Stripe.BalanceTransaction | null })[] };
  }).charges?.data?.[0];
  const meta = (session.metadata ?? {}) as ParsedMetadata;
  if (!meta.centerId) return;

  const email = session.customer_details?.email ?? null;
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const person = await findOrCreatePerson(
    meta.centerId,
    email,
    meta.firstName ?? "",
    meta.lastName ?? "",
    stripeCustomerId,
  );

  const intended = meta.intendedAmount ? Number(meta.intendedAmount) : (session.amount_total ?? 0);
  const amountDollars = intended / 100;
  const feesCents = (charge?.balance_transaction as Stripe.BalanceTransaction | undefined)?.fee ?? null;

  const tributeNote = meta.tribute ? `\n\nTribute: ${meta.tribute}` : "";

  await prisma.$transaction(async (tx) => {
    if (charge && (await tx.donation.findUnique({ where: { stripeChargeId: charge.id } }))) return;
    const donation = await tx.donation.create({
      data: {
        personId: person.id,
        centerId: person.centerId,
        date: new Date(),
        amount: new Prisma.Decimal(amountDollars),
        paymentMethod: "ONLINE",
        source: "STRIPE",
        campaignId: meta.campaignId ?? null,
        receiptSent: true,
        thankYouSent: false,
        stripeChargeId: charge?.id ?? null,
        stripeFeesCents: feesCents,
        donorCoveredFees: meta.coverFees === "1",
        notes: `Online gift via Stripe.${tributeNote}`,
      },
    });
    await tx.contact.create({
      data: {
        personId: person.id,
        centerId: person.centerId,
        date: donation.date,
        contactType: "ONLINE",
        outcome: "MADE_DONATION",
        donationId: donation.id,
        notes: "Auto-logged: online gift",
      },
    });
    await recomputePerson(tx, person.id);
  });
}

async function handleInvoicePaid(stripe: Stripe, invoice: Stripe.Invoice) {
  const subId = (invoice as Stripe.Invoice & { subscription?: string }).subscription;
  if (!subId || typeof subId !== "string") return;
  const subscription = await stripe.subscriptions.retrieve(subId);
  const meta = (subscription.metadata ?? {}) as ParsedMetadata;
  if (!meta.centerId) return;

  const email = invoice.customer_email ?? null;
  const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : null;
  const person = await findOrCreatePerson(
    meta.centerId,
    email,
    meta.firstName ?? "",
    meta.lastName ?? "",
    stripeCustomerId,
  );
  const chargeId =
    (invoice as Stripe.Invoice & { charge?: string }).charge ||
    (invoice as Stripe.Invoice & { payment_intent?: string }).payment_intent ||
    invoice.id;

  if (!chargeId) return;
  if (await prisma.donation.findUnique({ where: { stripeChargeId: chargeId } })) return;

  const amountDollars = (invoice.amount_paid ?? 0) / 100;
  await prisma.$transaction(async (tx) => {
    const donation = await tx.donation.create({
      data: {
        personId: person.id,
        centerId: person.centerId,
        date: new Date(),
        amount: new Prisma.Decimal(amountDollars),
        paymentMethod: "ONLINE",
        source: "STRIPE",
        campaignId: meta.campaignId ?? null,
        receiptSent: true,
        thankYouSent: false,
        stripeChargeId: chargeId,
        stripeSubscriptionId: subId,
        donorCoveredFees: meta.coverFees === "1",
        notes: "Recurring online gift via Stripe.",
      },
    });
    if (!person.givingFrequency || person.givingFrequency === "ONE_TIME") {
      await tx.person.update({ where: { id: person.id }, data: { givingFrequency: "MONTHLY" } });
    }
    await tx.contact.create({
      data: {
        personId: person.id,
        centerId: person.centerId,
        date: donation.date,
        contactType: "ONLINE",
        outcome: "MADE_DONATION",
        donationId: donation.id,
        notes: "Auto-logged: recurring online gift",
      },
    });
    await recomputePerson(tx, person.id);
  });
}

async function handleRefund(charge: Stripe.Charge) {
  const donation = await prisma.donation.findUnique({ where: { stripeChargeId: charge.id } });
  if (!donation) return;
  await prisma.$transaction(async (tx) => {
    await tx.donation.update({
      where: { id: donation.id },
      data: { notes: (donation.notes ?? "") + `\n\nRefunded ${new Date().toISOString()}.` },
    });
    await tx.donation.delete({ where: { id: donation.id } });
    await recomputePerson(tx, donation.personId);
  });
}
