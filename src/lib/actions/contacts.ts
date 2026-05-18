"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds, requireWriteAccess } from "@/lib/auth-dev";
import { recomputePerson } from "@/lib/recompute";

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

