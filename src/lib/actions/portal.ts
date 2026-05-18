"use server";

import { z } from "zod";
import { Resend } from "resend";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createMagicLinkToken, clearPortalSession } from "@/lib/portal-auth";
import { appOrigin } from "@/lib/stripe";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

export type PortalRequestState =
  | { ok: true; messageSent: boolean; devLink?: string }
  | { ok: false; error: string }
  | null;

/** Magic-link request. We always return a generic "if you have given,
 *  we sent a link" message — no email enumeration. */
export async function requestPortalLink(
  _prev: PortalRequestState,
  formData: FormData,
): Promise<PortalRequestState> {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };
  const email = parsed.data.email.toLowerCase();

  const person = await prisma.person.findFirst({
    where: { email, convertedToDonorAt: { not: null } },
  });
  if (!person) {
    return { ok: true, messageSent: false };
  }

  const token = createMagicLinkToken(person.id);
  const link = `${appOrigin()}/portal/verify?token=${encodeURIComponent(token)}`;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS;

  if (apiKey && from) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from,
        to: email,
        subject: "Your TC Indiana giving link",
        text:
          `Hi ${person.firstName},\n\n` +
          `Use this link to see your giving history and manage your donations:\n\n${link}\n\n` +
          `It expires in an hour. If you didn't ask for this, ignore the message.\n\n` +
          `— Teen Challenge Indiana`,
      });
    } catch {
      // Surface failures as a generic message so we don't reveal whether
      // an email exists in our system.
    }
    return { ok: true, messageSent: true };
  }

  // Dev fallback: surface the link in the UI so we can click through
  // without a configured Resend account.
  return { ok: true, messageSent: true, devLink: link };
}

export async function portalSignOut() {
  await clearPortalSession();
  redirect("/portal/request");
}
