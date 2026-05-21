"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds, requireWriteAccess } from "@/lib/auth";
import { recomputePerson } from "@/lib/recompute";
import type { ContactOutcome as ContactOutcomeEnum, ContactType as ContactTypeEnum } from "@/generated/prisma";

const ContactType = z.enum([
  "PHONE_CALL", "EMAIL", "IN_PERSON_MEETING", "EVENT", "MAIL", "TEXT_MESSAGE", "ONLINE",
]);
const ContactOutcome = z.enum([
  "MADE_DONATION", "SCHEDULED_FOLLOW_UP", "NO_ANSWER", "LEFT_MESSAGE",
  "NOT_INTERESTED", "INFORMATION_SENT", "OTHER",
]);

const optional = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), s.optional());

const schema = z.object({
  personId: z.string().min(1),
  date: z.preprocess((v) => (v ? new Date(String(v)) : new Date()), z.date()),
  contactType: ContactType,
  outcome: ContactOutcome,
  notes: optional(z.string()),
  nextFollowUpAt: optional(z.preprocess((v) => (v ? new Date(String(v)) : undefined), z.date())),
});

export type LogContactState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

export async function logContact(
  _prev: LogContactState,
  formData: FormData,
): Promise<LogContactState> {
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
  const me = await requireWriteAccess(person.centerId);

  await prisma.$transaction(async (tx) => {
    await tx.contact.create({
      data: {
        personId: person.id,
        centerId: person.centerId,
        date: data.date,
        contactType: data.contactType,
        outcome: data.outcome,
        notes: data.notes,
        nextFollowUpAt: data.nextFollowUpAt,
        staffUserId: me.id,
      },
    });
    await recomputePerson(tx, person.id);
  });

  revalidatePath(`/people/${person.id}`);
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");
  return { ok: true };
}

export type QuickOutcome =
  | "SCHEDULED_MEETING"
  | "LEFT_VOICEMAIL"
  | "LEFT_TEXT"
  | "NO_ANSWER"
  | "NOT_INTERESTED";

const QUICK_PRESETS: Record<
  QuickOutcome,
  { contactType: ContactTypeEnum; outcome: ContactOutcomeEnum; notes: string }
> = {
  SCHEDULED_MEETING: { contactType: "PHONE_CALL", outcome: "SCHEDULED_FOLLOW_UP", notes: "Scheduled meeting" },
  LEFT_VOICEMAIL: { contactType: "PHONE_CALL", outcome: "LEFT_MESSAGE", notes: "Left voicemail" },
  LEFT_TEXT: { contactType: "TEXT_MESSAGE", outcome: "LEFT_MESSAGE", notes: "Left text message" },
  NO_ANSWER: { contactType: "PHONE_CALL", outcome: "NO_ANSWER", notes: "No answer" },
  NOT_INTERESTED: { contactType: "PHONE_CALL", outcome: "NOT_INTERESTED", notes: "Not interested" },
};

/** One-click contact log for the follow-up queue. Creates a Contact row
 *  with sensible defaults for the outcome, then runs `recomputePerson`
 *  in the same transaction so `lastContactAt` (and derived alert color)
 *  reset immediately. */
export async function quickLogContact(
  personId: string,
  outcome: QuickOutcome,
): Promise<{ ok: boolean; error?: string }> {
  const preset = QUICK_PRESETS[outcome];
  if (!preset) return { ok: false, error: "Unknown outcome" };

  const accessible = await getAccessibleCenterIds();
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person || !accessible.includes(person.centerId)) {
    return { ok: false, error: "Person not found" };
  }
  const me = await requireWriteAccess(person.centerId);

  await prisma.$transaction(async (tx) => {
    await tx.contact.create({
      data: {
        personId: person.id,
        centerId: person.centerId,
        date: new Date(),
        contactType: preset.contactType,
        outcome: preset.outcome,
        notes: preset.notes,
        staffUserId: me.id,
      },
    });
    await recomputePerson(tx, person.id);
  });

  revalidatePath(`/people/${person.id}`);
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");
  return { ok: true };
}
