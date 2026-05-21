"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CENTER_SCOPE_COOKIE, CENTER_SCOPE_ALL } from "@/lib/center-scope";

/** Server action triggered by the top-bar center selector. Stores the
 *  chosen center (or "all") in a cookie and revalidates the layout so
 *  every cached read picks up the new filter on next render. */
export async function selectCenterScope(value: string): Promise<void> {
  const jar = await cookies();
  const v = value || CENTER_SCOPE_ALL;
  jar.set(CENTER_SCOPE_COOKIE, v, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });
  revalidatePath("/", "layout");
}
