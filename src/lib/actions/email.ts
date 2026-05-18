"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getAccessibleCenterIds, requireWriteAccess } from "@/lib/auth";
import { recomputePerson } from "@/lib/recompute";

const schema = z.object({
  personId: z.string().min(1),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body can't be empty"),
});

export type SendEmailState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

/** Send an email to a Person via Resend and log a Contact entry.
 *
 *  Scope is intentionally narrow: we send from a single shared
 *  RESEND_FROM_ADDRESS rather than the staff member's own mailbox.
 *  Per-user OAuth-based "send as me" is a Phase 4.5 feature.
 *
 *  When RESEND_API_KEY isn't set, the email still logs as a Contact
 *  entry (with a note that the email wasn't actually sent), so the app
 *  is usable without an external provider during dev.
 */
export async function sendEmailToPerson(
  _prev: SendEmailState,
  formData: FormData,
): Promise<SendEmailState> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { personId, subject, body } = parsed.data;

  const accessible = await getAccessibleCenterIds();
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person || !accessible.includes(person.centerId)) {
    return { ok: false, error: "Person not found" };
  }
  if (!person.email) return { ok: false, error: "This person has no email address on file." };
  await requireWriteAccess(person.centerId);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS;
  let sendNote = "";

  if (apiKey && from) {
    try {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from,
        to: person.email,
        subject,
        text: body,
        replyTo: me.email,
      });
      if (result.error) {
        return { ok: false, error: `Resend rejected the email: ${result.error.message}` };
      }
    } catch (err) {
      return { ok: false, error: `Failed to send: ${(err as Error).message}` };
    }
  } else {
    sendNote = "\n\n[Resend not configured — email not actually sent. Contact logged for record-keeping.]";
  }

  await prisma.$transaction(async (tx) => {
    await tx.contact.create({
      data: {
        personId: person.id,
        centerId: person.centerId,
        date: new Date(),
        contactType: "EMAIL",
        outcome: "INFORMATION_SENT",
        staffUserId: me.id,
        notes: `Subject: ${subject}\n\n${body}${sendNote}`,
      },
    });
    await recomputePerson(tx, person.id);
  });

  revalidatePath(`/people/${person.id}`);
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  return { ok: true };
}
