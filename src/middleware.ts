import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuth0Client } from "@/lib/auth0";

export async function middleware(request: NextRequest) {
  // Skip Auth0 entirely for public/system endpoints: donation flow,
  // Stripe webhook, donor portal, and cron jobs. Auth0 attaches a
  // session cookie even on routes it isn't gating, which adds latency
  // we don't need on these hot paths.
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/give") ||
    path.startsWith("/portal") ||
    path.startsWith("/api/give") ||
    path.startsWith("/api/stripe") ||
    path.startsWith("/api/portal") ||
    path.startsWith("/api/cron")
  ) {
    return NextResponse.next();
  }
  const auth0 = getAuth0Client();
  if (!auth0) return NextResponse.next();
  return auth0.middleware(request);
}

export const config = {
  // Auth0 SDK owns /auth/* — everything else passes through. Exclude
  // static assets so they don't trip the session check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|css|js)$).*)"],
};
