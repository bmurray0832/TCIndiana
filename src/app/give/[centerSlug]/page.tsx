import { notFound } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DonationForm } from "@/components/give/DonationForm";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function CenterDonationPage({
  params,
}: {
  params: Promise<{ centerSlug: string }>;
}) {
  const { centerSlug } = await params;
  const center = await prisma.center.findFirst({
    where: { OR: [{ donationPageSlug: centerSlug }, { slug: centerSlug }] },
    include: {
      organization: true,
      campaigns: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  if (!center) notFound();

  // Org-wide campaigns too
  const orgCampaigns = await prisma.campaign.findMany({
    where: { organizationId: center.organizationId, active: true, centerId: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const allCampaigns = [...center.campaigns, ...orgCampaigns];
  const stripeReady = isStripeConfigured();

  return (
    <>
      <Link href="/give" className="mb-4 inline-block text-xs text-muted-foreground hover:text-primary">
        ← All centers
      </Link>

      <header className="mb-8">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-md text-white"
          style={{ backgroundColor: center.brandColor ?? "hsl(var(--primary))" }}
        >
          <Heart className="h-5 w-5" />
        </div>
        <h1 className="mt-3 text-2xl font-bold">Give to {center.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{center.organization.name}</p>
      </header>

      {!stripeReady ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/40 dark:text-yellow-200">
          <div className="font-semibold">Online giving isn&apos;t live yet.</div>
          <p className="mt-1 text-xs">
            Set <code className="font-mono">STRIPE_SECRET_KEY</code> and{" "}
            <code className="font-mono">STRIPE_WEBHOOK_SECRET</code> in the environment to enable
            this page. Until then, gifts can still be entered manually in the staff app.
          </p>
        </div>
      ) : (
        <DonationForm
          centerSlug={centerSlug}
          centerName={center.name}
          campaigns={allCampaigns}
        />
      )}
    </>
  );
}
