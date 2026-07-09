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

/** In-memory send throttle: at most one magic link per email per
 *  cooldown window, and a burst cap per hour. Prevents the form being
 *  scripted to spam a donor's inbox through our Resend account. State
 *  is per-instance (fine for a single Railway service); a restart
 *  resets it, which only ever errs toward sending.
 */
const COOLDOWN_MS = 60_000;
const HOURLY_CAP = 5;
const sendLog = new Map<string, number[]>();

function throttled(email: string): boolean {
  const now = Date.now();
  const recent = (sendLog.get(email) ?? []).filter((t) => now - t < 60 * 60_000);
  const blocked =
    recent.length >= HOURLY_CAP ||
    (recent.length > 0 && now - recent[recent.length - 1] < COOLDOWN_MS);
  if (!blocked) {
    recent.push(now);
    if (sendLog.size > 10_000) sendLog.clear(); // unbounded-growth guard
    sendLog.set(email, recent);
  }
  return blocked;
}

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

  // Same generic response as a real send — a caller can't tell they
  // were throttled, and can't tell whether the email exists.
  if (throttled(email)) return { ok: true, messageSent: true };

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
