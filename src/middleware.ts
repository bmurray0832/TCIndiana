import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuth0Client } from "@/lib/auth0";

export async function middleware(request: NextRequest) {
  const auth0 = getAuth0Client();
  if (!auth0) return NextResponse.next();
  return auth0.middleware(request);
}

export const config = {
  // Auth0 SDK owns /auth/* — everything else passes through. Exclude
  // static assets so they don't trip the session check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|css|js)$).*)"],
};
