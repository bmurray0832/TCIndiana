import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  await searchParams; // not currently used; reserved for displaying a confirmation
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-2xl font-bold">Thank you</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your gift is being processed. A receipt will land in your inbox in a few minutes.
      </p>
      <Link
        href="/give"
        className="mt-6 inline-block rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Back to giving
      </Link>
    </div>
  );
}
