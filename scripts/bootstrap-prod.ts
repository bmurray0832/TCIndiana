/**
 * One-time production bootstrap — safe to run against a live database.
 *
 * Creates (idempotently, never deleting anything):
 *   - the Organization
 *   - one or more Centers
 *   - the first ORG_ADMIN user, so Auth0's first sign-in matches a User
 *     row instead of landing on /access-pending
 *
 * Usage (locally, pointed at the production DATABASE_URL):
 *   BOOTSTRAP_ADMIN_EMAIL=you@tcindiana.org \
 *   BOOTSTRAP_ADMIN_NAME="Your Name" \
 *   BOOTSTRAP_CENTERS="Main Center,Center 2" \
 *   npm run db:bootstrap
 *
 * Env vars:
 *   BOOTSTRAP_ADMIN_EMAIL  (required) — email you'll sign into Auth0 with
 *   BOOTSTRAP_ADMIN_NAME   (optional, default "Org Admin")
 *   BOOTSTRAP_ORG_NAME     (optional, default "Teen Challenge Indiana")
 *   BOOTSTRAP_ORG_SLUG     (optional, default "tc-indiana")
 *   BOOTSTRAP_CENTERS      (optional, comma-separated, default "Main Center")
 *
 * Additional staff users are created afterwards in Settings → Users.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("✗ BOOTSTRAP_ADMIN_EMAIL is required — the email you'll sign into Auth0 with.");
    process.exit(1);
  }
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME ?? "Org Admin";
  const orgName = process.env.BOOTSTRAP_ORG_NAME ?? "Teen Challenge Indiana";
  const orgSlug = process.env.BOOTSTRAP_ORG_SLUG ?? "tc-indiana";
  const centerNames = (process.env.BOOTSTRAP_CENTERS ?? "Main Center")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {},
    create: { name: orgName, slug: orgSlug },
  });
  console.log(`Organization: ${org.name} (${org.slug})`);

  const centerIds: string[] = [];
  for (const name of centerNames) {
    const slug = slugify(name);
    const center = await prisma.center.upsert({
      where: { slug },
      update: {},
      create: {
        organizationId: org.id,
        name,
        slug,
        donationPageSlug: slug,
      },
    });
    centerIds.push(center.id);
    console.log(`  ✓ Center: ${center.name} (/give/${center.donationPageSlug})`);
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: { orgRole: "ORG_ADMIN", active: true },
    create: {
      organizationId: org.id,
      email: adminEmail.toLowerCase(),
      name: adminName,
      orgRole: "ORG_ADMIN",
    },
  });
  for (const centerId of centerIds) {
    await prisma.userCenterRole.upsert({
      where: { userId_centerId: { userId: admin.id, centerId } },
      update: { role: "DIRECTOR" },
      create: { userId: admin.id, centerId, role: "DIRECTOR" },
    });
  }
  console.log(`Admin: ${admin.email} (ORG_ADMIN, DIRECTOR on ${centerIds.length} center${centerIds.length === 1 ? "" : "s"})`);
  console.log("\nDone. Sign in via Auth0 with that email — you'll land on /dashboard.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
