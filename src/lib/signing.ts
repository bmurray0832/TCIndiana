import crypto from "node:crypto";

/** Stateless HMAC-signed tokens for the donor portal magic-link flow
 *  and the resulting "I'm signed in" cookie. Reuses AUTH0_SECRET when
 *  set so we don't add a new env var requirement.
 */

function getSecret(): string {
  const secret = process.env.PORTAL_SECRET ?? process.env.AUTH0_SECRET;
  if (secret) return secret;
  // A guessable secret would let anyone mint a donor's session.
  if (process.env.NODE_ENV === "production") {
    throw new Error("PORTAL_SECRET (or AUTH0_SECRET) must be set in production.");
  }
  return "dev-portal-secret-do-not-use-in-production";
}

export function signPayload<T extends object>(payload: T, ttlSeconds: number): string {
  const data = { ...payload, exp: Date.now() + ttlSeconds * 1000 };
  const b64 = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyPayload<T extends object>(token: string | undefined | null): T | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(b64).digest("base64url");
  const given = Buffer.from(sig, "base64url");
  const want = Buffer.from(expected, "base64url");
  // timingSafeEqual throws on a length mismatch; a malformed token is just invalid.
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;
  try {
    const data = JSON.parse(Buffer.from(b64, "base64url").toString()) as T & { exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
