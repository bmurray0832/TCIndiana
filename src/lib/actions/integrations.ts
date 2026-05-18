"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { disconnectMsGraph } from "@/lib/microsoft-graph";

export async function disconnectOutlook(): Promise<void> {
  const me = await getCurrentUser();
  if (!me) return;
  await disconnectMsGraph(me.id);
  revalidatePath("/settings/integrations");
}
