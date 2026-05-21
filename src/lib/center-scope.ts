/** Global center filter.
 *
 *  - getAccessibleCenterIds() (in auth.ts) is the AUTHORIZATION gate —
 *    every centre the user is allowed to see.
 *  - getActiveCenterIds() (here) is the DISPLAY filter — what they've
 *    chosen to view right now via the top-bar selector. Falls back to
 *    accessible when nothing is selected.
 *
 *  Write paths keep using getAccessibleCenterIds so that picking a
 *  single centre in the selector doesn't affect what staff can edit;
 *  only what they see.
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds } from "@/lib/auth";

const COOKIE = "tcindiana_center";
const ALL = "__all__";

export async function getCenterScopeCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function getActiveCenterIds(): Promise<string[]> {
  const accessible = await getAccessibleCenterIds();
  if (accessible.length === 0) return [];
  const selected = await getCenterScopeCookie();
  if (!selected || selected === ALL) return accessible;
  if (!accessible.includes(selected)) return accessible;
  return [selected];
}

/** Returns the menu data + currently-selected center for the top-bar
 *  dropdown. Drops to null `selected` when "All centers" is active. */
export async function getCenterScope() {
  const accessibleIds = await getAccessibleCenterIds();
  if (accessibleIds.length === 0) {
    return { centers: [], selected: null as null };
  }
  const centers = await prisma.center.findMany({
    where: { id: { in: accessibleIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const cookie = await getCenterScopeCookie();
  const selected = cookie && cookie !== ALL && accessibleIds.includes(cookie)
    ? centers.find((c) => c.id === cookie) ?? null
    : null;
  return { centers, selected };
}

export const CENTER_SCOPE_COOKIE = COOKIE;
export const CENTER_SCOPE_ALL = ALL;
