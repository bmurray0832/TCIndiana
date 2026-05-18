import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tokensFromCode, isMsGraphConfigured } from "@/lib/microsoft-graph";
import { verifyPayload } from "@/lib/signing";
import { appOrigin } from "@/lib/stripe";

export async function GET(request: Request) {
  if (!isMsGraphConfigured()) {
    return new NextResponse("Microsoft Graph not configured", { status: 503 });
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(`${appOrigin()}/settings/integrations?error=${encodeURIComponent(err)}`);
  }
  if (!code || !state) {
    return new NextResponse("Missing code or state", { status: 400 });
  }

  const verified = verifyPayload<{ uid: string }>(state);
  if (!verified) return new NextResponse("Invalid state", { status: 400 });

  try {
    const tokens = await tokensFromCode(code);
    await prisma.user.update({
      where: { id: verified.uid },
      data: { msGraphTokens: tokens as unknown as Record<string, string> },
    });
  } catch (e) {
    return NextResponse.redirect(
      `${appOrigin()}/settings/integrations?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  return NextResponse.redirect(`${appOrigin()}/settings/integrations?connected=outlook`);
}
