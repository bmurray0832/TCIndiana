"use server";

import { revalidatePath } from "next/cache";
import { authorizeOrg, getCurrentUser } from "@/lib/auth";
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

export type BloomerangSyncState = SyncSummary | { ok: true; saved: true } | null;

/** HQ admins only. Saves the Bloomerang settings (landing center, the
 *  custom field that names a center, and what each of its values
 *  means), then runs a sync unless the form only asked to save. */
export async function syncBloomerang(
  _prev: BloomerangSyncState,
  formData: FormData,
): Promise<BloomerangSyncState> {
  const gate = await authorizeOrg("integrations:manage");
  if (!gate.ok) return gate;
  const me = gate.user;
  const intent = String(formData.get("intent") ?? "sync");

  const centerId = String(formData.get("centerId") ?? "");
  if (!me.orgCenterIds.includes(centerId)) {
    return { ok: false, error: "Pick the center new constituents should land in." };
  }
  const field = String(formData.get("centerField") ?? "").trim().slice(0, 200);

  // Mapping rows arrive as map:<rowId> = <centerId or "">.
  const decisions: { id: string; centerId: string | null }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("map:") || typeof value !== "string") continue;
    if (value !== "" && !me.orgCenterIds.includes(value)) {
      return { ok: false, error: "One of the mapped centers isn't in your organization." };
    }
    decisions.push({ id: key.slice(4), centerId: value || null });
  }

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: me.organizationId },
      data: { bloomerangDefaultCenterId: centerId, bloomerangCenterField: field || null },
    }),
    ...decisions.map((d) =>
      prisma.bloomerangCenterMap.updateMany({
        where: { id: d.id, organizationId: me.organizationId },
        data: { centerId: d.centerId },
      }),
    ),
  ]);
  revalidatePath("/settings/integrations");
  if (intent === "save") return { ok: true, saved: true };

  if (!isBloomerangConfigured()) return { ok: false, error: "BLOOMERANG_API_KEY is not set on the server." };
  const result = await runBloomerangSync({
    organizationId: me.organizationId,
    userId: me.id,
    full: intent === "full",
  });
  if (result.ok) {
    for (const p of ["/dashboard", "/donors", "/prospects", "/donations", "/contacts", "/import", "/settings/integrations"]) {
      revalidatePath(p);
    }
  }
  return result;
}
