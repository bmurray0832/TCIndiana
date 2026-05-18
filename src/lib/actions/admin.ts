"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const OrgRole = z.enum(["ORG_ADMIN", "STAFF"]);
const CenterRole = z.enum(["DIRECTOR", "STAFF", "VIEWER"]);

const optional = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), s.optional());

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  orgRole: OrgRole,
  // Stored in FormData as repeated `centerRoles=centerId:ROLE` entries.
});

export type UserFormState =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

async function requireOrgAdmin() {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in");
  if (me.orgRole !== "ORG_ADMIN") throw new Error("HQ admin only");
  return me;
}

function parseCenterRoles(formData: FormData): { centerId: string; role: "DIRECTOR" | "STAFF" | "VIEWER" }[] {
  const out: { centerId: string; role: "DIRECTOR" | "STAFF" | "VIEWER" }[] = [];
  for (const entry of formData.getAll("centerRoles")) {
    if (typeof entry !== "string") continue;
    const [centerId, roleStr] = entry.split(":");
    if (!centerId || !roleStr) continue;
    const parsed = CenterRole.safeParse(roleStr);
    if (parsed.success) out.push({ centerId, role: parsed.data });
  }
  return out;
}

export async function createUser(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const me = await requireOrgAdmin();
  const obj = Object.fromEntries(formData.entries());
  const parsed = userSchema.safeParse(obj);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  const centerRoles = parseCenterRoles(formData);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return { ok: false, error: "A user with that email already exists." };
  }

  const user = await prisma.user.create({
    data: {
      organizationId: me.organizationId,
      email: data.email,
      name: data.name,
      orgRole: data.orgRole,
      centerRoles: { create: centerRoles },
    },
  });
  revalidatePath("/settings/users");
  return { ok: true, id: user.id };
}

export async function updateUser(
  id: string,
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const me = await requireOrgAdmin();
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== me.organizationId) {
    return { ok: false, error: "User not found." };
  }
  const obj = Object.fromEntries(formData.entries());
  const parsed = userSchema.safeParse(obj);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  const centerRoles = parseCenterRoles(formData);

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { name: data.name, email: data.email, orgRole: data.orgRole },
    }),
    prisma.userCenterRole.deleteMany({ where: { userId: id } }),
    prisma.userCenterRole.createMany({
      data: centerRoles.map((r) => ({ userId: id, ...r })),
      skipDuplicates: true,
    }),
  ]);
  revalidatePath("/settings/users");
  return { ok: true, id };
}

export async function setUserActive(id: string, active: boolean) {
  const me = await requireOrgAdmin();
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== me.organizationId) return { ok: false };
  if (id === me.id) return { ok: false }; // can't deactivate yourself
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/settings/users");
  return { ok: true };
}

// ─── Centers ────────────────────────────────────────────────────────

const centerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only"),
  donationPageSlug: optional(z.string().regex(/^[a-z0-9-]+$/)),
  address: optional(z.string()),
  brandColor: optional(z.string()),
});

const thresholdsSchema = z.object({
  donorYellow: z.coerce.number().int().positive(),
  donorOrange: z.coerce.number().int().positive(),
  donorRed: z.coerce.number().int().positive(),
  prospectYellow: z.coerce.number().int().positive(),
  prospectOrange: z.coerce.number().int().positive(),
  prospectRed: z.coerce.number().int().positive(),
});

export type CenterFormState =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

export async function createCenter(_prev: CenterFormState, formData: FormData): Promise<CenterFormState> {
  const me = await requireOrgAdmin();
  const parsed = centerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  const c = await prisma.center.create({
    data: {
      organizationId: me.organizationId,
      name: data.name,
      slug: data.slug,
      donationPageSlug: data.donationPageSlug ?? data.slug,
      address: data.address,
      brandColor: data.brandColor,
    },
  });
  revalidatePath("/settings/centers");
  revalidatePath("/settings");
  return { ok: true, id: c.id };
}

export async function updateCenter(
  id: string,
  _prev: CenterFormState,
  formData: FormData,
): Promise<CenterFormState> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  const c = await prisma.center.findUnique({ where: { id } });
  if (!c || c.organizationId !== me.organizationId) return { ok: false, error: "Center not found" };
  const isOrgAdmin = me.orgRole === "ORG_ADMIN";
  const isDirector = me.centerRoles.some((r) => r.centerId === id && r.role === "DIRECTOR");
  if (!isOrgAdmin && !isDirector) return { ok: false, error: "Only HQ admin or center director can edit." };

  const parsed = centerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;
  await prisma.center.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug,
      donationPageSlug: data.donationPageSlug ?? data.slug,
      address: data.address,
      brandColor: data.brandColor,
    },
  });
  revalidatePath("/settings/centers");
  revalidatePath("/settings");
  return { ok: true, id };
}

export async function setCenterThresholds(
  id: string,
  _prev: CenterFormState,
  formData: FormData,
): Promise<CenterFormState> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };
  const c = await prisma.center.findUnique({ where: { id } });
  if (!c || c.organizationId !== me.organizationId) return { ok: false, error: "Center not found" };
  const isOrgAdmin = me.orgRole === "ORG_ADMIN";
  const isDirector = me.centerRoles.some((r) => r.centerId === id && r.role === "DIRECTOR");
  if (!isOrgAdmin && !isDirector) return { ok: false, error: "Only HQ admin or center director can edit thresholds." };

  const parsed = thresholdsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, error: "All thresholds must be positive whole numbers." };
  }
  const t = parsed.data;
  await prisma.center.update({
    where: { id },
    data: {
      alertThresholds: {
        donor: { yellow: t.donorYellow, orange: t.donorOrange, red: t.donorRed },
        prospect: { yellow: t.prospectYellow, orange: t.prospectOrange, red: t.prospectRed },
      },
    },
  });
  revalidatePath("/settings/centers");
  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");
  return { ok: true, id };
}

export async function clearCenterThresholds(id: string) {
  const me = await getCurrentUser();
  if (!me) return { ok: false };
  const c = await prisma.center.findUnique({ where: { id } });
  if (!c || c.organizationId !== me.organizationId) return { ok: false };
  const isOrgAdmin = me.orgRole === "ORG_ADMIN";
  const isDirector = me.centerRoles.some((r) => r.centerId === id && r.role === "DIRECTOR");
  if (!isOrgAdmin && !isDirector) return { ok: false };
  await prisma.center.update({ where: { id }, data: { alertThresholds: Prisma.JsonNull } });
  revalidatePath("/settings/centers");
  return { ok: true };
}
