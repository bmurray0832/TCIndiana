"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds, requireWriteAccess } from "@/lib/auth";

/** Snooze a person from the follow-up queue for N days. Setting days=0
 *  clears any active snooze. */
export async function snoozePerson(personId: string, days: number): Promise<{ ok: boolean; error?: string }> {
  const accessible = await getAccessibleCenterIds();
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person || !accessible.includes(person.centerId)) {
    return { ok: false, error: "Person not found" };
  }
  await requireWriteAccess(person.centerId);

  const until = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  await prisma.person.update({
    where: { id: personId },
    data: { snoozedUntil: until },
  });

  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
  revalidatePath(`/people/${personId}`);
  return { ok: true };
}
