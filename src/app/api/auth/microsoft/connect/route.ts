import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { authorizeUrl, isMsGraphConfigured } from "@/lib/microsoft-graph";
import { signPayload } from "@/lib/signing";

export async function GET() {
  if (!isMsGraphConfigured()) {
    return new NextResponse("Microsoft Graph not configured", { status: 503 });
  }
  const me = await getCurrentUser();
  if (!me) return new NextResponse("Sign in first", { status: 401 });

  // Signed state carries the userId so the callback can attach tokens
  // to the right row without a server-side session lookup race.
  const state = signPayload({ uid: me.id }, 60 * 10);
  return NextResponse.redirect(authorizeUrl(state));
}
