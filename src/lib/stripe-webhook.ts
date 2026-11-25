/** What each Stripe event does to our records. Kept apart from the
 *  HTTP route (which only verifies the signature) so it can be run
 *  against a database with a stand-in Stripe client.
 *
 *  Rules:
 *   - A gift is recorded only once the money has actually been
 *     collected. Bank (ACH) payments complete checkout while still
 *     pending, so they are recorded on async_payment_succeeded and a
 *     failed one is never recorded at all.
 *   - The payment intent id is the idempotency key. Stripe redelivers
 *     events; a redelivery finds the existing gift and does nothing.
 *   - The recorded amount is what the donor was charged (their gift,
 *     including any fees they chose to cover). The processor fee is
 *     stored alongside so reports can show gross, fees and net.
 */

import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recomputePerson } from "@/lib/recompute";

type Meta = {
  centerId?: string;
  campaignId?: string;
  firstName?: string;
  lastName?: string;
  coverFees?: string;
  tribute?: string;
};

/** The slice of the Stripe client the handlers use. */
export type StripeLike = {
  paymentIntents: { retrieve(id: string, params?: { expand?: string[] }): Promise<Stripe.PaymentIntent> };
  subscriptions: { retrieve(id: string): Promise<Stripe.Subscription> };
  invoices: { retrieve(id: string, params?: { expand?: string[] }): Promise<Stripe.Invoice> };
};

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

export async function handleStripeEvent(stripe: StripeLike, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      // Subscriptions are recorded per invoice, below.
      if (session.mode !== "payment" || session.payment_status !== "paid") return;
      const intentId = idOf(session.payment_intent);
      if (!intentId) return;
      await recordGift(stripe, {
        intentId,
        meta: (session.metadata ?? {}) as Meta,
        email: session.customer_details?.email ?? session.customer_email ?? null,
        customerId: idOf(session.customer),
      });
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
      if (!subscriptionId || !invoice.id) return;
      const full = await stripe.invoices.retrieve(invoice.id, { expand: ["payments"] });
      const intentId = (full.payments?.data ?? [])
        .map((p) => idOf(p.payment.payment_intent))
        .find((id): id is string => !!id);
      if (!intentId) return; // e.g. a $0 invoice
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await recordGift(stripe, {
        intentId,
        meta: (subscription.metadata ?? {}) as Meta,
        email: invoice.customer_email,
        customerId: idOf(invoice.customer),
        subscriptionId,
      });
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      if (!idOf(invoice.parent?.subscription_details?.subscription)) return;
      await flagForFollowUp(idOf(invoice.customer), "Monthly gift payment failed");
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const person = await flagForFollowUp(idOf(sub.customer), "Monthly gift ended");
      if (person?.givingFrequency === "MONTHLY") {
        await prisma.person.update({ where: { id: person.id }, data: { givingFrequency: "IRREGULAR" } });
      }
      return;
    }
    case "charge.refunded":
      await applyRefund(event.data.object);
      return;
    case "charge.updated": {
      // Fees for bank payments are only known after the gift is recorded.
      const charge = event.data.object;
      const fee = typeof charge.balance_transaction === "object" ? charge.balance_transaction?.fee : undefined;
      if (typeof fee === "number") {
        await prisma.donation.updateMany({
          where: { stripeChargeId: charge.id, stripeFeesCents: null },
          data: { stripeFeesCents: fee },
        });
      }
      return;
    }
    default:
      return;
  }
}

async function findOrCreatePerson(centerId: string, email: string | null, meta: Meta, customerId: string | null) {
  if (customerId) {
    const byStripe = await prisma.person.findUnique({ where: { stripeCustomerId: customerId } });
    if (byStripe) return byStripe;
  }
  if (email) {
    const byEmail = await prisma.person.findFirst({
      where: { centerId, email: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    });
    if (byEmail) {
      return customerId && !byEmail.stripeCustomerId
        ? prisma.person.update({ where: { id: byEmail.id }, data: { stripeCustomerId: customerId } })
        : byEmail;
    }
  }
  return prisma.person.create({
    data: {
      centerId,
      firstName: meta.firstName || "Anonymous",
      lastName: meta.lastName || "Donor",
      email,
      source: "ONLINE",
      stripeCustomerId: customerId,
    },
  });
}

async function recordGift(
  stripe: StripeLike,
  input: { intentId: string; meta: Meta; email: string | null; customerId: string | null; subscriptionId?: string },
) {
  const { intentId, meta } = input;
  if (!meta.centerId) return; // not a gift from our donation pages
  if (await prisma.donation.findUnique({ where: { stripePaymentIntentId: intentId }, select: { id: true } })) return;

  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge.balance_transaction"] });
  if (intent.status !== "succeeded") return;
  const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const balance = charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;

  const center = await prisma.center.findUnique({ where: { id: meta.centerId }, select: { organizationId: true } });
  if (!center) return;
  const campaign = meta.campaignId
    ? await prisma.campaign.findFirst({
        where: { id: meta.campaignId, organizationId: center.organizationId },
        select: { id: true },
      })
    : null;

  const person = await findOrCreatePerson(meta.centerId, input.email, meta, input.customerId);
  const recurring = !!input.subscriptionId;
  const date = new Date((charge?.created ?? intent.created) * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      const donation = await tx.donation.create({
        data: {
          personId: person.id,
          centerId: person.centerId,
          date,
          amount: new Prisma.Decimal(intent.amount_received).div(100),
          paymentMethod: "ONLINE",
          source: "STRIPE",
          campaignId: campaign?.id ?? null,
          receiptSent: true, // Stripe emails the receipt
          thankYouSent: false,
          stripePaymentIntentId: intent.id,
          stripeChargeId: charge?.id ?? null,
          stripeSubscriptionId: input.subscriptionId ?? null,
          stripeFeesCents: balance?.fee ?? null,
          donorCoveredFees: meta.coverFees === "1",
          notes:
            (recurring ? "Recurring online gift via Stripe." : "Online gift via Stripe.") +
            (meta.tribute ? `\n\nTribute: ${meta.tribute}` : ""),
        },
      });
      if (recurring && (!person.givingFrequency || person.givingFrequency === "ONE_TIME")) {
        await tx.person.update({ where: { id: person.id }, data: { givingFrequency: "MONTHLY" } });
      }
      await tx.contact.create({
        data: {
          personId: person.id,
          centerId: person.centerId,
          date,
          contactType: "ONLINE",
          outcome: "MADE_DONATION",
          donationId: donation.id,
          notes: recurring ? "Auto-logged: recurring online gift" : "Auto-logged: online gift",
        },
      });
      await recomputePerson(tx, person.id);
    });
  } catch (e) {
    // Two deliveries raced; the other one recorded the gift.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
}

/** A full refund removes the gift; a partial refund reduces it to what
 *  the donor actually ended up giving. Computed from Stripe's running
 *  totals, so a redelivered event lands on the same result. */
async function applyRefund(charge: Stripe.Charge) {
  const intentId = idOf(charge.payment_intent);
  const donation = await prisma.donation.findFirst({
    where: { OR: [{ stripeChargeId: charge.id }, ...(intentId ? [{ stripePaymentIntentId: intentId }] : [])] },
  });
  if (!donation) return;
  const keptCents = charge.amount - charge.amount_refunded;
  const stamp = new Date().toISOString().slice(0, 10);

  await prisma.$transaction(async (tx) => {
    if (keptCents <= 0) {
      await tx.contact.updateMany({
        where: { donationId: donation.id },
        data: { donationId: null, outcome: "OTHER", notes: `Online gift of $${donation.amount} refunded ${stamp}.` },
      });
      await tx.donation.delete({ where: { id: donation.id } });
    } else {
      const base = (donation.notes ?? "").replace(/\n\nPartially refunded.*$/s, "");
      await tx.donation.update({
        where: { id: donation.id },
        data: {
          amount: new Prisma.Decimal(keptCents).div(100),
          notes: `${base}\n\nPartially refunded: $${(charge.amount_refunded / 100).toFixed(2)} of $${(charge.amount / 100).toFixed(2)} returned (${stamp}).`,
        },
      });
    }
    await recomputePerson(tx, donation.personId);
  });
}

/** Put a donor back in front of staff when their recurring gift needs a
 *  human: sets the next step (unless staff already wrote one) and lifts
 *  any snooze. */
async function flagForFollowUp(customerId: string | null, what: string) {
  if (!customerId) return null;
  const person = await prisma.person.findUnique({ where: { stripeCustomerId: customerId } });
  if (!person) return null;
  const stamp = new Date().toISOString().slice(0, 10);
  return prisma.person.update({
    where: { id: person.id },
    data: { nextStep: person.nextStep ?? `${what} (${stamp}) — reach out`, snoozedUntil: null },
  });
}
