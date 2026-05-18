"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds, requireWriteAccess } from "@/lib/auth-dev";

const PreferredContact = z.enum(["EMAIL", "PHONE", "MAIL", "IN_PERSON", "TEXT"]);
const ProspectSource = z.enum([
  "EVENT", "REFERRAL", "WALK_IN", "ONLINE", "SOCIAL_MEDIA",
  "EMAIL_CAMPAIGN", "ANNUAL_GALA", "COMMUNITY_EVENT", "OTHER",
]);
const InterestLevel = z.enum(["HOT", "WARM", "COLD"]);
const DonorStatus = z.enum(["ACTIVE", "LAPSED", "MAJOR_DONOR"]);
const GivingFrequency = z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUAL", "IRREGULAR"]);

const optional = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), s.optional());

const personSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  centerId: z.string().min(1, "Center is required"),
  email: optional(z.string().email("Invalid email")),
  phone: optional(z.string()),
  organization: optional(z.string()),
  preferredContact: optional(PreferredContact),
  source: optional(ProspectSource),
  interestLevel: optional(InterestLevel),
  donorStatus: optional(DonorStatus),
  givingFrequency: optional(GivingFrequency),
  nextStep: optional(z.string()),
  notes: optional(z.string()),
});

export type PersonFormState =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

function parseFormData(formData: FormData) {
  const obj: Record<string, FormDataEntryValue | null> = {};
  for (const [k, v] of formData.entries()) obj[k] = v;
  return personSchema.safeParse(obj);
}

export async function addPerson(
  _prev: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  await requireWriteAccess(data.centerId);

  const person = await prisma.person.create({
    data: {
      centerId: data.centerId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      organization: data.organization,
      preferredContact: data.preferredContact,
      source: data.source,
      interestLevel: data.interestLevel,
      donorStatus: data.donorStatus,
      givingFrequency: data.givingFrequency,
      nextStep: data.nextStep,
      notes: data.notes,
      dateAdded: new Date(),
    },
  });

  revalidatePath("/prospects");
  revalidatePath("/donors");
  redirect(`/people/${person.id}`);
}

export async function updatePerson(
  id: string,
  _prev: PersonFormState,
  formData: FormData,
): Promise<PersonFormState> {
  const accessibleCenters = await getAccessibleCenterIds();
  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing || !accessibleCenters.includes(existing.centerId)) {
    return { ok: false, error: "Person not found." };
  }
  await requireWriteAccess(existing.centerId);

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  await prisma.person.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      centerId: data.centerId,
      email: data.email ?? null,
      phone: data.phone ?? null,
      organization: data.organization ?? null,
      preferredContact: data.preferredContact ?? null,
      source: data.source ?? null,
      interestLevel: data.interestLevel ?? null,
      donorStatus: data.donorStatus ?? null,
      givingFrequency: data.givingFrequency ?? null,
      nextStep: data.nextStep ?? null,
      notes: data.notes ?? null,
    },
  });

  revalidatePath(`/people/${id}`);
  revalidatePath("/prospects");
  revalidatePath("/donors");
  return { ok: true, id };
}

