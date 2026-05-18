/**
 * Seed the dev database from nonprofit_crm_v2_final.xlsm.
 *
 * Usage:
 *   1. Make sure DATABASE_URL is set in .env
 *   2. Drop a copy of nonprofit_crm_v2_final.xlsm at the repo root
 *      (or set CRM_XLSX_PATH).
 *   3. `npm run db:migrate` to create tables.
 *   4. `npm run db:seed`.
 *
 * Idempotent: it wipes the org and re-creates it on each run.
 */

import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { PrismaClient, Prisma } from "../src/generated/prisma";

const prisma = new PrismaClient();

const XLSX_PATH =
  process.env.CRM_XLSX_PATH ??
  path.join(process.cwd(), "nonprofit_crm_v2_final.xlsm");

type Row = Record<string, unknown>;

function cell(row: Row, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return null;
}

function num(row: Row, ...keys: string[]): number | null {
  const s = cell(row, ...keys);
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function date(row: Row, ...keys: string[]): Date | null {
  for (const k of keys) {
    const v = row[k];
    if (v instanceof Date) return v;
    if (typeof v === "number") {
      const ms = (v - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof v === "string" && v.trim()) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function mapInterest(v: string | null) {
  switch (v?.toLowerCase()) {
    case "hot": return "HOT" as const;
    case "warm": return "WARM" as const;
    case "cold": return "COLD" as const;
    default: return null;
  }
}

function mapDonorStatus(v: string | null) {
  switch (v?.toLowerCase()) {
    case "active": return "ACTIVE" as const;
    case "lapsed": return "LAPSED" as const;
    case "major donor": return "MAJOR_DONOR" as const;
    default: return null;
  }
}

function mapSource(v: string | null) {
  switch (v?.toLowerCase()) {
    case "event": return "EVENT" as const;
    case "referral": return "REFERRAL" as const;
    case "walk-in": return "WALK_IN" as const;
    case "online": return "ONLINE" as const;
    case "social media": return "SOCIAL_MEDIA" as const;
    case "email campaign": return "EMAIL_CAMPAIGN" as const;
    case "annual gala": return "ANNUAL_GALA" as const;
    case "community event": return "COMMUNITY_EVENT" as const;
    default: return v ? ("OTHER" as const) : null;
  }
}

function mapPreferredContact(v: string | null) {
  switch (v?.toLowerCase()) {
    case "email": return "EMAIL" as const;
    case "phone": return "PHONE" as const;
    case "mail": return "MAIL" as const;
    case "in-person": return "IN_PERSON" as const;
    case "text": return "TEXT" as const;
    default: return null;
  }
}

function mapGivingFrequency(v: string | null) {
  switch (v?.toLowerCase()) {
    case "one-time": return "ONE_TIME" as const;
    case "monthly": return "MONTHLY" as const;
    case "quarterly": return "QUARTERLY" as const;
    case "annual": return "ANNUAL" as const;
    case "irregular": return "IRREGULAR" as const;
    default: return null;
  }
}

function mapContactType(v: string | null) {
  switch (v?.toLowerCase()) {
    case "phone call": return "PHONE_CALL" as const;
    case "email": return "EMAIL" as const;
    case "in-person meeting": return "IN_PERSON_MEETING" as const;
    case "event": return "EVENT" as const;
    case "mail": return "MAIL" as const;
    case "text message": return "TEXT_MESSAGE" as const;
    default: return "EMAIL" as const;
  }
}

function mapOutcome(v: string | null) {
  switch (v?.toLowerCase()) {
    case "made donation": return "MADE_DONATION" as const;
    case "scheduled follow-up": return "SCHEDULED_FOLLOW_UP" as const;
    case "no answer": return "NO_ANSWER" as const;
    case "left message": return "LEFT_MESSAGE" as const;
    case "not interested": return "NOT_INTERESTED" as const;
    case "information sent": return "INFORMATION_SENT" as const;
    default: return "OTHER" as const;
  }
}

function mapPayment(v: string | null) {
  switch (v?.toLowerCase()) {
    case "check": return "CHECK" as const;
    case "credit card": return "CREDIT_CARD" as const;
    case "cash": return "CASH" as const;
    case "online": return "ONLINE" as const;
    case "bank transfer": return "BANK_TRANSFER" as const;
    default: return "CHECK" as const;
  }
}

async function main() {
  console.log(`📂 Loading workbook from ${XLSX_PATH}`);
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`\n✗ Could not find ${XLSX_PATH}.`);
    console.error(`  Set CRM_XLSX_PATH or copy the spreadsheet to the repo root.\n`);
    process.exit(1);
  }
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });

  // Helper to read a sheet starting at the header row that contains "ID"
  // or another known column (the workbook has banner rows above the
  // actual headers).
  function readSheet(sheetName: string, headerRow: number): Row[] {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      console.warn(`  (sheet "${sheetName}" not found, skipping)`);
      return [];
    }
    return XLSX.utils.sheet_to_json<Row>(ws, { range: headerRow - 1, defval: null });
  }

  console.log("🧹 Wiping existing data");
  await prisma.auditLog.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.person.deleteMany();
  await prisma.userCenterRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.center.deleteMany();
  await prisma.organization.deleteMany();

  console.log("🏢 Creating organization + centers");
  const org = await prisma.organization.create({
    data: {
      name: "Teen Challenge Indiana",
      slug: "tc-indiana",
    },
  });

  const centerNames = ["Main Center", "Center 2", "Center 3", "Center 4", "Center 5", "Center 6"];
  const centersByName: Record<string, string> = {};
  for (const name of centerNames) {
    const c = await prisma.center.create({
      data: {
        organizationId: org.id,
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        donationPageSlug: name.toLowerCase().replace(/\s+/g, "-"),
      },
    });
    centersByName[name] = c.id;
  }
  const defaultCenterId = centersByName["Main Center"];

  console.log("👥 Creating staff users");
  const refRows = readSheet("Reference Data", 1);
  const staffNames = refRows
    .map((r) => cell(r, "Staff Names"))
    .filter((s): s is string => !!s);

  const usersByName: Record<string, string> = {};
  // Director + a few staff
  const director = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "director@tcindiana.org",
      name: "Director Account",
      orgRole: "ORG_ADMIN",
      centerRoles: {
        create: Object.values(centersByName).map((centerId) => ({
          centerId,
          role: "DIRECTOR" as const,
        })),
      },
    },
  });
  console.log(`  ✓ ${director.email} (ORG_ADMIN)`);

  for (const name of staffNames) {
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@tcindiana.org`;
    const u = await prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        name,
        orgRole: "STAFF",
        centerRoles: {
          create: [{ centerId: defaultCenterId, role: "STAFF" as const }],
        },
      },
    });
    usersByName[name] = u.id;
  }

  console.log("🎯 Creating campaigns");
  const campaignNames = new Set<string>();
  for (const r of refRows) {
    const c = cell(r, "Campaign Purpose");
    if (c) campaignNames.add(c);
  }
  const campaignsByName: Record<string, string> = {};
  for (const name of campaignNames) {
    const c = await prisma.campaign.create({
      data: { organizationId: org.id, name, active: true },
    });
    campaignsByName[name] = c.id;
  }

  console.log("💼 Importing prospects");
  const prospectRows = readSheet("Prospects", 5);
  let prospectCount = 0;
  const peopleByName: Record<string, string> = {};
  for (const r of prospectRows) {
    const firstName = cell(r, "First Name");
    const lastName = cell(r, "Last Name");
    if (!firstName || !lastName) continue;
    const centerName = cell(r, "Center") ?? "Main Center";
    const centerId = centersByName[centerName] ?? defaultCenterId;
    const p = await prisma.person.create({
      data: {
        centerId,
        firstName,
        lastName,
        email: cell(r, "Email"),
        phone: cell(r, "Phone"),
        source: mapSource(cell(r, "Source")),
        interestLevel: mapInterest(cell(r, "Interest")),
        preferredContact: mapPreferredContact(cell(r, "Pref Contact")),
        nextStep: cell(r, "Next Step"),
        notes: cell(r, "Notes"),
        dateAdded: date(r, "Date Added") ?? new Date(),
        lastContactAt: date(r, "Last Contact"),
      },
    });
    peopleByName[`${firstName} ${lastName}`] = p.id;
    prospectCount++;
  }
  console.log(`  ✓ ${prospectCount} prospects`);

  console.log("🤝 Importing donors");
  const donorRows = readSheet("Donors", 5);
  let donorCount = 0;
  for (const r of donorRows) {
    const firstName = cell(r, "First Name");
    const lastName = cell(r, "Last Name");
    if (!firstName || !lastName) continue;
    const centerName = cell(r, "Center") ?? "Main Center";
    const centerId = centersByName[centerName] ?? defaultCenterId;
    const lastDonAt = date(r, "Last Don Date");
    const p = await prisma.person.create({
      data: {
        centerId,
        firstName,
        lastName,
        email: cell(r, "Email"),
        phone: cell(r, "Phone"),
        organization: cell(r, "Organization"),
        donorStatus: mapDonorStatus(cell(r, "Status")),
        givingFrequency: mapGivingFrequency(cell(r, "Giving Freq")),
        preferredContact: mapPreferredContact(cell(r, "Pref Contact")),
        notes: cell(r, "Notes"),
        lastContactAt: date(r, "Last Contact"),
        lastDonationAt: lastDonAt,
        convertedToDonorAt: lastDonAt ?? new Date(),
        lifetimeAmount: new Prisma.Decimal(num(r, "Total Lifetime") ?? 0),
        ytdAmount: new Prisma.Decimal(num(r, "This Year") ?? 0),
        lastYearAmount: new Prisma.Decimal(num(r, "Last Year") ?? 0),
      },
    });
    peopleByName[`${firstName} ${lastName}`] = p.id;
    donorCount++;
  }
  console.log(`  ✓ ${donorCount} donors`);

  console.log("💵 Importing donations");
  const donationRows = readSheet("Donations", 5);
  let donationCount = 0;
  for (const r of donationRows) {
    const name = cell(r, "Donor Name");
    if (!name) continue;
    const personId = peopleByName[name];
    if (!personId) continue;
    const amount = num(r, "Amount");
    if (!amount) continue;
    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) continue;
    const campaignName = cell(r, "Campaign");
    await prisma.donation.create({
      data: {
        personId,
        centerId: person.centerId,
        date: date(r, "Date") ?? new Date(),
        amount: new Prisma.Decimal(amount),
        paymentMethod: mapPayment(cell(r, "Payment")),
        campaignId: campaignName ? campaignsByName[campaignName] : null,
        receiptSent: (cell(r, "Receipt") ?? "").toLowerCase() === "yes",
        thankYouSent: (cell(r, "Thank You") ?? "").toLowerCase() === "yes",
        notes: cell(r, "Notes"),
      },
    });
    donationCount++;
  }
  console.log(`  ✓ ${donationCount} donations`);

  console.log("📞 Importing contact log");
  const contactRows = readSheet("Contact Log", 5);
  let contactCount = 0;
  for (const r of contactRows) {
    const name = cell(r, "Contact Name");
    if (!name) continue;
    const personId = peopleByName[name];
    if (!personId) continue;
    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) continue;
    const staffName = cell(r, "Staff");
    await prisma.contact.create({
      data: {
        personId,
        centerId: person.centerId,
        date: date(r, "Date") ?? new Date(),
        contactType: mapContactType(cell(r, "Contact Type")),
        staffUserId: staffName ? usersByName[staffName] ?? null : null,
        outcome: mapOutcome(cell(r, "Outcome")),
        notes: cell(r, "Notes"),
        nextFollowUpAt: date(r, "Next Follow-up"),
      },
    });
    contactCount++;
  }
  console.log(`  ✓ ${contactCount} contacts`);

  console.log("\n✓ Seed complete");
  console.log(`   Organization: ${org.name}`);
  console.log(`   Centers: ${centerNames.length}`);
  console.log(`   People: ${prospectCount + donorCount}`);
  console.log(`   Donations: ${donationCount}`);
  console.log(`   Contacts: ${contactCount}`);
  console.log(`\n   Log in as: ${director.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
