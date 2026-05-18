/** Microsoft Graph OAuth + sendMail. Per-user tokens stored on
 *  User.msGraphTokens. The user gives consent once via the connect
 *  flow; afterwards we refresh the access token on demand and send
 *  via /me/sendMail so emails come from their address with replies
 *  routing back to their inbox.
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SEND_MAIL_URL = "https://graph.microsoft.com/v1.0/me/sendMail";

// `offline_access` gives us a refresh token; Mail.Send is the minimum
// scope we need to send messages.
const SCOPES = ["offline_access", "Mail.Send", "User.Read"].join(" ");

export type MsGraphTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
  scope: string;
  account?: string;  // upn / email
};

export function isMsGraphConfigured(): boolean {
  return !!process.env.MS_GRAPH_CLIENT_ID && !!process.env.MS_GRAPH_CLIENT_SECRET;
}

function appOrigin(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

function redirectUri(): string {
  return `${appOrigin()}/api/auth/microsoft/callback`;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MS_GRAPH_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    response_mode: "query",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeForTokens(form: URLSearchParams): Promise<MsGraphTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };
  let account: string | undefined;
  if (json.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(json.id_token.split(".")[1], "base64").toString());
      account = payload.preferred_username || payload.email;
    } catch {
      account = undefined;
    }
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope,
    account,
  };
}

export async function tokensFromCode(code: string): Promise<MsGraphTokens> {
  const form = new URLSearchParams({
    client_id: process.env.MS_GRAPH_CLIENT_ID!,
    client_secret: process.env.MS_GRAPH_CLIENT_SECRET!,
    code,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
    scope: SCOPES,
  });
  return exchangeForTokens(form);
}

async function refreshTokens(refreshToken: string): Promise<MsGraphTokens> {
  const form = new URLSearchParams({
    client_id: process.env.MS_GRAPH_CLIENT_ID!,
    client_secret: process.env.MS_GRAPH_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES,
  });
  return exchangeForTokens(form);
}

/** Returns a fresh access token, refreshing + persisting if needed. */
async function getValidAccessToken(userId: string): Promise<MsGraphTokens | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.msGraphTokens) return null;
  const tokens = user.msGraphTokens as unknown as MsGraphTokens;

  if (new Date(tokens.expiresAt).getTime() > Date.now() + 60_000) return tokens;

  try {
    const fresh = await refreshTokens(tokens.refreshToken);
    await prisma.user.update({
      where: { id: userId },
      data: { msGraphTokens: fresh as unknown as Record<string, string> },
    });
    return fresh;
  } catch {
    return null;
  }
}

export async function sendMailAsUser(
  userId: string,
  args: { to: string; subject: string; body: string; replyTo?: string },
): Promise<{ ok: true; account: string | undefined } | { ok: false; error: string }> {
  const tokens = await getValidAccessToken(userId);
  if (!tokens) return { ok: false, error: "Mailbox not connected (or refresh failed)." };

  const message: Record<string, unknown> = {
    subject: args.subject,
    body: { contentType: "Text", content: args.body },
    toRecipients: [{ emailAddress: { address: args.to } }],
  };
  if (args.replyTo) message.replyTo = [{ emailAddress: { address: args.replyTo } }];

  const res = await fetch(SEND_MAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Graph rejected sendMail (${res.status}): ${detail.slice(0, 200)}` };
  }
  return { ok: true, account: tokens.account };
}

export async function disconnectMsGraph(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { msGraphTokens: Prisma.JsonNull } });
}
