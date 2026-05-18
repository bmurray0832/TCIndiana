import Link from "next/link";
import { Heart } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GiveLandingPage() {
  const centers = await prisma.center.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, donationPageSlug: true, slug: true, address: true },
  });

  return (
    <>
      <header className="mb-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Heart className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Give to Teen Challenge Indiana</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick the center you&apos;d like your gift to support.
        </p>
      </header>

      <ul className="space-y-2">
        {centers.map((c) => (
          <li key={c.id}>
            <Link
              href={`/give/${c.donationPageSlug ?? c.slug}`}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/40"
            >
              <div>
                <div className="font-semibold">{c.name}</div>
                {c.address && <div className="text-xs text-muted-foreground">{c.address}</div>}
              </div>
              <span className="text-sm font-medium text-primary">Give →</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
