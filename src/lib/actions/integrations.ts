"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { disconnectMsGraph } from "@/lib/microsoft-graph";
import { prisma } from "@/lib/prisma";
import { isBloomerangConfigured } from "@/lib/bloomerang/client";
import { runBloomerangSync, type SyncSummary } from "@/lib/bloomerang/sync";

export async function disconnectOutlook(): Promise<void> {
  const me = await getCurrentUser();
  if (!me) return;
  await disconnectMsGraph(me.id);
  revalidatePath("/settings/integrations");
}

export type BloomerangSyncState = SyncSummary | null;

/** HQ admins only: save the landing center and pull from Bloomerang. */
export async function syncBloomerang(
  _prev: BloomerangSyncState,
  formData: FormData,
): Promise<BloomerangSyncState> {
  const me = await getCurrentUser();
  if (!me || me.orgRole !== "ORG_ADMIN") return { ok: false, error: "Only HQ admins can run the Bloomerang sync." };
  if (!isBloomerangConfigured()) return { ok: false, error: "BLOOMERANG_API_KEY is not set on the server." };

  const centerId = String(formData.get("centerId") ?? "");
  const center = await prisma.center.findFirst({
    where: { id: centerId, organizationId: me.organizationId },
    select: { id: true },
  });
  if (!center) return { ok: false, error: "Pick the center new constituents should land in." };
  await prisma.organization.update({
    where: { id: me.organizationId },
    data: { bloomerangDefaultCenterId: center.id },
  });
  revalidatePath("/settings/integrations"); // keep the chosen center selected even if the sync fails

  const result = await runBloomerangSync({
    organizationId: me.organizationId,
    userId: me.id,
    full: formData.get("full") === "1",
  });
  if (result.ok) {
    for (const p of ["/dashboard", "/donors", "/prospects", "/donations", "/contacts", "/import", "/settings/integrations"]) {
      revalidatePath(p);
    }
  }
  return result;
}
