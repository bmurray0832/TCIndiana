import Link from "next/link";
import { readMagicLinkToken } from "@/lib/portal-auth";
import { completePortalSignIn } from "@/lib/actions/portal";

export const dynamic = "force-dynamic";

/** Landing page for the emailed sign-in link. Opening it only checks
 *  the link; the donor presses Continue to sign in. That way an email
 *  scanner that opens every link doesn't use up a link that works once. */
export default async function PortalVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; expired?: string }>;
}) {
  const { token, expired } = await searchParams;
  if (expired || !token || !readMagicLinkToken(token)) return <BadLink />;

  return (
    <div className="text-center">
      <h1 className="text-xl font-bold">Sign in to your giving</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        One more step to see your giving history and manage your donations.
      </p>
      <form action={completePortalSignIn} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Continue
        </button>
      </form>
    </div>
  );
}

function BadLink() {
  return (
    <div className="text-center">
      <h1 className="text-xl font-bold">That link has expired or was already used</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign-in links last for an hour and work once. Request a fresh one and try again.
      </p>
      <Link
        href="/portal/request"
        className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Request a new link
      </Link>
    </div>
  );
}
