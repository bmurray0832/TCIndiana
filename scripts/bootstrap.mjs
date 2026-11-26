/**
 * Production bootstrap — runs on every deploy, right after migrations.
 *
 * Makes sure the organization, its centers and the first HQ admin
 * exist, so the first Auth0 sign-in matches a user instead of landing
 * on "access pending". It only ever adds: nothing is deleted, an
 * existing center or person is never renamed, and a user who already
 * exists keeps their name. Running it again changes nothing.
 *
 * Driven by environment variables (set them on the Railway service):
 *   BOOTSTRAP_ADMIN_EMAIL  the email the first admin signs in with.
 *                          When unset, this script does nothing.
 *   BOOTSTRAP_ADMIN_NAME   optional, default "Org Admin"
 *   BOOTSTRAP_CENTERS      comma-separated center names, default "Main Center"
 *   BOOTSTRAP_ORG_NAME     optional, default "Teen Challenge Indiana"
 *   BOOTSTRAP_ORG_SLUG     optional, default "tc-indiana"
 *
 * Plain JavaScript on purpose: the production image has no TypeScript
 * runner. Also runnable by hand: `npm run db:bootstrap`.
 */

import { createRequire } from "node:module";

const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
if (!adminEmail) {
  console.log("bootstrap: BOOTSTRAP_ADMIN_EMAIL not set — nothing to do.");
  process.exit(0);
}

const { PrismaClient } = createRequire(import.meta.url)("../src/generated/prisma");
const prisma = new PrismaClient();

const slugify = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

try {
  const orgSlug = process.env.BOOTSTRAP_ORG_SLUG || "tc-indiana";
  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {},
    create: { name: process.env.BOOTSTRAP_ORG_NAME || "Teen Challenge Indiana", slug: orgSlug },
  });
  console.log(`bootstrap: organization "${org.name}"`);

  const names = (process.env.BOOTSTRAP_CENTERS || "Main Center").split(",").map((s) => s.trim()).filter(Boolean);
  const centerIds = [];
  for (const name of names) {
    const slug = slugify(name);
    const existing = await prisma.center.findUnique({ where: { slug } });
    if (existing && existing.organizationId !== org.id) {
      throw new Error(`A center with the address "${slug}" already belongs to another organization.`);
    }
    const center =
      existing ??
      (await prisma.center.create({ data: { organizationId: org.id, name, slug, donationPageSlug: slug } }));
    centerIds.push(center.id);
    console.log(`bootstrap: center "${center.name}"${existing ? "" : " (created)"}`);
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin && existingAdmin.organizationId !== org.id) {
    throw new Error("That admin email already belongs to a user in another organization.");
  }
  const admin = existingAdmin
    ? await prisma.user.update({ where: { id: existingAdmin.id }, data: { orgRole: "ORG_ADMIN", active: true } })
    : await prisma.user.create({
        data: {
          organizationId: org.id,
          email: adminEmail,
          name: process.env.BOOTSTRAP_ADMIN_NAME || "Org Admin",
          orgRole: "ORG_ADMIN",
        },
      });
  for (const centerId of centerIds) {
    await prisma.userCenterRole.upsert({
      where: { userId_centerId: { userId: admin.id, centerId } },
      update: {},
      create: { userId: admin.id, centerId, role: "DIRECTOR" },
    });
  }
  console.log(`bootstrap: HQ admin ready${existingAdmin ? "" : " (created)"} on ${centerIds.length} center(s)`);
} catch (e) {
  // Fail the deploy loudly rather than go live half set up.
  console.error("bootstrap failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
