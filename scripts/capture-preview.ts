import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const PAGES: { name: string; path: string; selector?: string; wait?: number }[] = [
  { name: "01-dashboard", path: "/dashboard" },
  { name: "02-prospects", path: "/prospects" },
  { name: "03-donors", path: "/donors" },
  { name: "04-person-detail", path: "/people/auto" }, // will be rewritten below
  { name: "05-follow-ups", path: "/follow-ups" },
  { name: "06-contacts", path: "/contacts" },
  { name: "07-donations", path: "/donations" },
  { name: "08-report-monthly", path: "/reports/monthly" },
  { name: "09-report-campaigns", path: "/reports/campaigns" },
  { name: "10-report-biggest-supporters", path: "/reports/biggest-supporters" },
  { name: "11-report-retention", path: "/reports/retention?cohortYear=2024" },
  { name: "12-report-funnel", path: "/reports/funnel?window=90" },
  { name: "13-report-yoy", path: "/reports/yoy" },
  { name: "14-reports-landing", path: "/reports" },
  { name: "15-settings-hub", path: "/settings" },
  { name: "16-settings-users", path: "/settings/users" },
  { name: "17-settings-centers", path: "/settings/centers" },
  { name: "18-settings-integrations", path: "/settings/integrations" },
  { name: "19-import-landing", path: "/import" },
  { name: "20-import-constituents", path: "/import/constituents" },
  { name: "21-login", path: "/login" },
  { name: "22-give-landing", path: "/give" },
  { name: "23-give-center", path: "/give/main-center" },
  { name: "24-portal-request", path: "/portal/request" },
];

async function pickPersonId(): Promise<string> {
  const { PrismaClient } = await import("../src/generated/prisma");
  const prisma = new PrismaClient();
  const p = await prisma.person.findFirst({
    where: { donations: { some: {} }, contacts: { some: {} } },
    orderBy: { lifetimeAmount: "desc" },
  });
  await prisma.$disconnect();
  if (!p) throw new Error("No seeded person found");
  return p.id;
}

(async () => {
  const personId = await pickPersonId();
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const outDir = path.join(process.cwd(), "preview-screenshots");
  fs.mkdirSync(outDir, { recursive: true });

  for (const spec of PAGES) {
    const url = `http://localhost:3000${spec.path.replace("/auto", "/" + personId)}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      if (spec.wait) await page.waitForTimeout(spec.wait);
      const file = path.join(outDir, `${spec.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`✓ ${spec.name}  ←  ${url}`);
    } catch (e) {
      console.error(`✗ ${spec.name}: ${(e as Error).message}`);
    }
  }

  await browser.close();
  console.log(`\nDone → ${outDir}`);
})();
