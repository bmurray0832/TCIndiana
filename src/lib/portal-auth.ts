import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signPayload, verifyPayload } from "@/lib/signing";

const COOKIE_NAME = "tcindiana_portal";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAGIC_LINK_TTL_SECONDS = 60 * 60; // 1 hour

// The two token kinds share a signing key, so each carries its kind and
// is rejected when presented as the other.
type SessionPayload = { t: "session"; pid: string };
type MagicLinkPayload = { t: "link"; pid: string; jti: string };

/** Mint a sign-in link token. Each one is a database row so it can be
 *  used exactly once. */
export async function createMagicLinkToken(personId: string): Promise<string> {
  const row = await prisma.portalLoginToken.create({
    data: { personId, expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000) },
    select: { id: true },
  });
  return signPayload<MagicLinkPayload>({ t: "link", pid: personId, jti: row.id }, MAGIC_LINK_TTL_SECONDS);
}

/** Check a link token without spending it (for showing the confirm
 *  page — mail scanners open links, and must not burn them). */
export function readMagicLinkToken(token: string): { personId: string; jti: string } | null {
  const data = verifyPayload<MagicLinkPayload>(token);
  return data && data.t === "link" && data.jti ? { personId: data.pid, jti: data.jti } : null;
}

/** Spend a link token. Returns the person id the first time only. */
export async function consumeMagicLinkToken(token: string): Promise<string | null> {
  const parsed = readMagicLinkToken(token);
  if (!parsed) return null;
  const spent = await prisma.portalLoginToken.updateMany({
    where: { id: parsed.jti, personId: parsed.personId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return spent.count === 1 ? parsed.personId : null;
}

/** At most one link a minute and five an hour per donor, so the form
 *  can't be scripted to flood someone's inbox. Database-backed, so it
 *  holds across restarts. */
export async function magicLinkThrottled(personId: string): Promise<boolean> {
  const recent = await prisma.portalLoginToken.findMany({
    where: { personId, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    take: 5,
  });
  return recent.length >= 5 || (recent.length > 0 && Date.now() - recent[0].createdAt.getTime() < 60_000);
}

export async function setPortalSession(personId: string) {
  const value = signPayload<SessionPayload>({ t: "session", pid: personId }, SESSION_TTL_SECONDS);
  const jar = await cookies();
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearPortalSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getPortalPerson() {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  const data = verifyPayload<SessionPayload>(value);
  if (!data || data.t !== "session") return null;
  return prisma.person.findUnique({
    where: { id: data.pid },
    include: {
      center: { select: { name: true } },
      donations: {
        orderBy: { date: "desc" },
        include: { campaign: { select: { name: true } } },
      },
    },
  });
}
