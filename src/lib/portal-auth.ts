import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signPayload, verifyPayload } from "@/lib/signing";

const COOKIE_NAME = "tcindiana_portal";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAGIC_LINK_TTL_SECONDS = 60 * 60; // 1 hour

type SessionPayload = { pid: string };
type MagicLinkPayload = { pid: string };

export function createMagicLinkToken(personId: string): string {
  return signPayload<MagicLinkPayload>({ pid: personId }, MAGIC_LINK_TTL_SECONDS);
}

export function readMagicLinkToken(token: string): { personId: string } | null {
  const data = verifyPayload<MagicLinkPayload>(token);
  return data ? { personId: data.pid } : null;
}

export async function setPortalSession(personId: string) {
  const value = signPayload<SessionPayload>({ pid: personId }, SESSION_TTL_SECONDS);
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
  if (!data) return null;
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
