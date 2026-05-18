import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { isAuth0Configured } from "@/lib/auth0";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const me = await getCurrentUser();
  if (me) redirect("/dashboard");

  const auth0 = isAuth0Configured();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Heart className="h-5 w-5" />
          </div>
          <h1 className="mt-3 text-lg font-semibold">TC Indiana CRM</h1>
          <p className="mt-1 text-xs text-muted-foreground">Sign in to continue</p>
        </div>

        {auth0 ? (
          <a
            href="/auth/login"
            className="block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Continue with Auth0
          </a>
        ) : (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-3 text-xs text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/40 dark:text-yellow-200">
            <div className="font-medium">Auth0 not configured.</div>
            <p className="mt-1">
              Running in dev mode using the seeded user from{" "}
              <code className="font-mono">DEV_USER_EMAIL</code>. Set the four{" "}
              <code className="font-mono">AUTH0_*</code> env vars and{" "}
              <code className="font-mono">APP_BASE_URL</code> to enable real sign-in.
            </p>
            <Link href="/dashboard" className="mt-2 inline-block font-medium hover:underline">
              Continue to dashboard →
            </Link>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Trouble signing in? Contact your TC Indiana admin.
      </p>
    </div>
  );
}
