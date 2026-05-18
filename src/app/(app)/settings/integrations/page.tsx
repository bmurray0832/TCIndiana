import Link from "next/link";
import { Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isMsGraphConfigured, type MsGraphTokens } from "@/lib/microsoft-graph";
import { disconnectOutlook } from "@/lib/actions/integrations";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me) return null;

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  const tokens = user?.msGraphTokens as unknown as MsGraphTokens | null;
  const outlookConnected = !!tokens?.accessToken;
  const outlookConfigured = isMsGraphConfigured();

  return (
    <div className="p-6">
      <Link href="/settings" className="mb-3 inline-block text-xs text-muted-foreground hover:text-primary">
        ← Back to settings
      </Link>
      <PageHeader
        title="Email integrations"
        subtitle="Connect your work mailbox so emails sent from the CRM come from your address and replies land in your inbox."
      />

      {sp.connected === "outlook" && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          Outlook connected.
        </div>
      )}
      {sp.error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {sp.error}
        </div>
      )}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0078D4] text-white">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Outlook / Microsoft 365</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Send emails via Microsoft Graph using your own mailbox.
              </p>
              {outlookConnected && tokens?.account && (
                <p className="mt-2 text-xs">
                  Connected as <span className="font-medium">{tokens.account}</span>
                </p>
              )}
              {!outlookConfigured && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Set <code className="font-mono">MS_GRAPH_CLIENT_ID</code> and{" "}
                  <code className="font-mono">MS_GRAPH_CLIENT_SECRET</code> to enable.
                </p>
              )}
            </div>
          </div>
          <div>
            {outlookConnected ? (
              <form action={disconnectOutlook}>
                <button
                  type="submit"
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Disconnect
                </button>
              </form>
            ) : outlookConfigured ? (
              <a
                href="/api/auth/microsoft/connect"
                className="inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Connect
              </a>
            ) : (
              <button
                disabled
                className="cursor-not-allowed rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium opacity-60"
              >
                Not configured
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-lg border border-dashed border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#EA4335] text-white">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Gmail / Google Workspace</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Same pattern as Outlook. Not wired up yet — Phase 4.6.
            </p>
          </div>
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        When no mailbox is connected, the &ldquo;Send email&rdquo; composer falls back to a shared TC Indiana
        address via Resend.
      </p>
    </div>
  );
}
