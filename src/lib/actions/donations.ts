"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds, requireWriteAccess } from "@/lib/auth-dev";
import { recomputePerson } from "@/lib/recompute";

const PaymentMethod = z.enum(["CHECK", "CREDIT_CARD", "CASH", "ONLINE", "BANK_TRANSFER"]);

const optional = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), s.optional());

const schema = z.object({
  personId: z.string().min(1),
  date: z.preprocess((v) => (v ? new Date(String(v)) : new Date()), z.date()),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paymentMethod: PaymentMethod,
  campaignId: optional(z.string()),
  receiptSent: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  thankYouSent: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  notes: optional(z.string()),
});

export type AddDonationState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

export async function addDonation(
  _prev: AddDonationState,
  formData: FormData,
): Promise<AddDonationState> {
  const obj: Record<string, FormDataEntryValue | null> = {};
  for (const [k, v] of formData.entries()) obj[k] = v;
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const accessible = await getAccessibleCenterIds();
  const person = await prisma.person.findUnique({ where: { id: data.personId } });
  if (!person || !accessible.includes(person.centerId)) {
    return { ok: false, error: "Person not found." };
  }
  await requireWriteAccess(person.centerId);

  await prisma.$transaction(async (tx) => {
    const donation = await tx.donation.create({
      data: {
        personId: person.id,
        centerId: person.centerId,
        date: data.date,
        amount: new Prisma.Decimal(data.amount),
        paymentMethod: data.paymentMethod,
        campaignId: data.campaignId,
        receiptSent: data.receiptSent,
        thankYouSent: data.thankYouSent,
        notes: data.notes,
        source: "MANUAL",
      },
    });

    // Also log a Contact row so the gift shows up in the contact history.
    await tx.contact.create({
      data: {
        personId: person.id,
        centerId: person.centerId,
        date: data.date,
        contactType: "IN_PERSON_MEETING",
        outcome: "MADE_DONATION",
        notes: data.notes ?? null,
        donationId: donation.id,
      },
    });

    await recomputePerson(tx, person.id);
  });

  revalidatePath(`/people/${person.id}`);
  revalidatePath("/donations");
  revalidatePath("/dashboard");
  revalidatePath("/donors");
  revalidatePath("/prospects");
  return { ok: true };
}
