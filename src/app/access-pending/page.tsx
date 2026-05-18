import { Heart } from "lucide-react";

export default function AccessPendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Heart className="h-5 w-5" />
          </div>
          <h1 className="mt-3 text-lg font-semibold">Access pending</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your Auth0 sign-in worked, but no user with your email is provisioned in TC Indiana CRM
          yet. Ask an HQ admin to add you in Settings → Users, then sign in again.
        </p>
        <a
          href="/auth/logout"
          className="mt-6 block w-full rounded-md border border-border bg-card px-3 py-2 text-center text-sm font-medium hover:bg-muted"
        >
          Sign out
        </a>
      </div>
    </div>
  );
}
