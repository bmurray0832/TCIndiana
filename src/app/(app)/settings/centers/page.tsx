import { PageHeader } from "@/components/PageHeader";
import { CentersList } from "@/components/settings/CentersList";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { effectiveThresholds } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export default async function CentersSettingsPage() {
  const me = await getCurrentUser();
  if (!me) return null;

  const org = await prisma.organization.findUnique({ where: { id: me.organizationId } });
  const centers = await prisma.center.findMany({
    where: { organizationId: me.organizationId },
    orderBy: { name: "asc" },
  });
  const orgDefaults = effectiveThresholds(org?.defaultAlertThresholds, null);
  const canCreate = me.orgRole === "ORG_ADMIN";

  return (
    <>
      <PageHeader
        title="Centers"
        subtitle={`${centers.length} centers · HQ admins set org-wide defaults; directors override per center`}
      />
      <CentersList centers={centers} orgDefaults={orgDefaults} canCreate={canCreate} />
    </>
  );
}
