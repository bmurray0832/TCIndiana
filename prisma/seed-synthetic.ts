/** Synthetic seed data — used when nonprofit_crm_v2_final.xlsm isn't
 *  available at the repo root. Produces ~30 donors and ~15 prospects
 *  across multiple centers, with realistic giving history and contact
 *  recency so the alert engine has interesting state to surface.
 */

import { Prisma } from "../src/generated/prisma";
import type { PrismaClient } from "../src/generated/prisma";

const FIRST_NAMES = [
  "Margaret","James","Patricia","William","Linda","Robert","Maria","David","Barbara","Richard",
  "Susan","Joseph","Jessica","Thomas","Sarah","Christopher","Karen","Daniel","Nancy","Matthew",
  "Lisa","Anthony","Betty","Mark","Sandra","Donald","Ashley","Steven","Kimberly","Paul",
  "Donna","Andrew","Emily","Kenneth","Michelle","George","Carol","Joshua","Amanda","Kevin",
];
const LAST_NAMES = [
  "Thompson","Rodriguez","Chen","O'Brien","Washington","Patel","Santos","Kim","Mueller","Jackson",
  "Anderson","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Brown","Davis","Miller","Moore",
  "Taylor","Jackson","White","Harris","Lewis","Clark","Robinson","Walker","Hall","Allen",
];

const CAMPAIGN_NAMES = [
  "One Time Gift",
  "Monthly Support",
  "Golf Outing",
  "Banquet",
  "Tuition",
  "Work Department",
  "Fundraising Donation",
  "Building Donation",
];
const SOURCES = ["EVENT", "REFERRAL", "WALK_IN", "ONLINE", "SOCIAL_MEDIA", "EMAIL_CAMPAIGN", "ANNUAL_GALA", "COMMUNITY_EVENT"] as const;
const INTERESTS = ["HOT", "WARM", "COLD"] as const;
const DONOR_STATUSES = ["ACTIVE", "LAPSED", "MAJOR_DONOR"] as const;
const FREQS = ["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUAL", "IRREGULAR"] as const;
const PAYMENTS = ["CHECK", "CREDIT_CARD", "CASH", "ONLINE", "BANK_TRANSFER"] as const;
const CONTACT_TYPES = ["PHONE_CALL", "EMAIL", "IN_PERSON_MEETING", "EVENT", "MAIL"] as const;
const OUTCOMES = ["SCHEDULED_FOLLOW_UP", "NO_ANSWER", "LEFT_MESSAGE", "INFORMATION_SENT", "MADE_DONATION", "NOT_INTERESTED"] as const;
const PROSPECT_NEXT_STEPS = [
  "Schedule initial meeting", "Send program information", "Follow up after gala",
  "Invite to center tour", "Coffee with executive director", "Mail welcome packet",
];
const PROSPECT_NOTES = [
  "Met at health fair — expressed interest in volunteering first",
  "Referred by a board member, high giving capacity",
  "Filled out contact form online, wants to meet",
  "Long-time community supporter, recently engaged with our newsletter",
  "Attended annual gala, mentioned interest in capital campaign",
  "Asked about donor recognition opportunities",
];
const DONOR_NOTES = [
  "Monthly donor since 2022",
  "Board member — capital campaign lead",
  "Annual year-end donor, prefers mail communication",
  "Quarterly donor, attends every gala",
  "Event sponsor for last three years",
  "Long-time supporter, has named us in their will",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysAgo(d: number): Date {
  const r = new Date();
  r.setDate(r.getDate() - d);
  return r;
}

export async function seedSynthetic(prisma: PrismaClient) {
  console.log("🌱 Loading synthetic seed data");

  const org = await prisma.organization.create({
    data: { name: "Teen Challenge Indiana", slug: "tc-indiana" },
  });

  const centerNames = ["Main Center", "Center 2", "Center 3", "Center 4", "Center 5", "Center 6"];
  const centers: Record<string, string> = {};
  for (const name of centerNames) {
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const c = await prisma.center.create({
      data: { organizationId: org.id, name, slug, donationPageSlug: slug },
    });
    centers[name] = c.id;
  }
  const mainCenterId = centers["Main Center"];

  console.log("👥 Staff users");
  const staffNames = ["John Smith", "Sarah Johnson", "Michael Brown", "Emily Davis"];
  const director = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "director@tcindiana.org",
      name: "Director Account",
      orgRole: "ORG_ADMIN",
      centerRoles: {
        create: Object.values(centers).map((centerId) => ({ centerId, role: "DIRECTOR" as const })),
      },
    },
  });
  const staffByName: Record<string, string> = {};
  for (const name of staffNames) {
    const u = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@tcindiana.org`,
        name,
        orgRole: "STAFF",
        centerRoles: { create: [{ centerId: mainCenterId, role: "STAFF" as const }] },
      },
    });
    staffByName[name] = u.id;
  }

  console.log("🎯 Campaigns");
  const campaigns: Record<string, string> = {};
  const goals: Record<string, number> = {
    "Building Donation": 250000,
    "Golf Outing": 50000,
    "Banquet": 75000,
  };
  for (const name of CAMPAIGN_NAMES) {
    const c = await prisma.campaign.create({
      data: {
        organizationId: org.id,
        name,
        active: true,
        goalAmount: goals[name] ? new Prisma.Decimal(goals[name]) : null,
      },
    });
    campaigns[name] = c.id;
  }

  console.log("💼 Prospects (15)");
  const usedNames = new Set<string>();
  function uniqueName(): { first: string; last: string } {
    for (let i = 0; i < 40; i++) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const key = `${first} ${last}`;
      if (!usedNames.has(key)) {
        usedNames.add(key);
        return { first, last };
      }
    }
    return { first: pick(FIRST_NAMES), last: pick(LAST_NAMES) + "-" + Math.floor(Math.random() * 99) };
  }

  let prospectCount = 0;
  for (let i = 0; i < 15; i++) {
    const { first, last } = uniqueName();
    const interest = i < 5 ? "HOT" : i < 10 ? "WARM" : "COLD";
    const daysAgoAdded = Math.floor(Math.random() * 200) + 10;
    const daysSinceContact = interest === "HOT" ? Math.floor(Math.random() * 20) + 5 : interest === "WARM" ? Math.floor(Math.random() * 60) + 20 : Math.floor(Math.random() * 120) + 60;
    const center = i < 12 ? "Main Center" : pick(centerNames);
    const person = await prisma.person.create({
      data: {
        centerId: centers[center],
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase().replace(/'/g, "")}@email.com`,
        phone: `555-${String(1000 + i).padStart(4, "0")}`,
        source: pick(SOURCES),
        interestLevel: interest,
        nextStep: pick(PROSPECT_NEXT_STEPS),
        notes: pick(PROSPECT_NOTES),
        dateAdded: daysAgo(daysAgoAdded),
        lastContactAt: daysAgo(daysSinceContact),
      },
    });
    // 1-3 contacts in their history
    const numContacts = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numContacts; j++) {
      await prisma.contact.create({
        data: {
          personId: person.id,
          centerId: person.centerId,
          date: daysAgo(daysSinceContact + j * 14),
          contactType: pick(CONTACT_TYPES),
          outcome: pick(OUTCOMES),
          staffUserId: staffByName[pick(staffNames)],
          notes: "Initial outreach — gauging interest.",
        },
      });
    }
    prospectCount++;
  }
  console.log(`  ✓ ${prospectCount} prospects`);

  console.log("🤝 Donors (28) + donations + contact history");
  let donorCount = 0;
  let donationCount = 0;
  let contactCount = 0;
  for (let i = 0; i < 28; i++) {
    const { first, last } = uniqueName();
    // A few major donors at the top, rest are active/lapsed
    const status: typeof DONOR_STATUSES[number] = i < 3 ? "MAJOR_DONOR" : i < 22 ? "ACTIVE" : "LAPSED";
    const center = i < 24 ? "Main Center" : pick(centerNames);
    const firstGiftDaysAgo = Math.floor(Math.random() * 1200) + 90;

    // Donor recency drives alert color — spread these out so we get a
    // realistic mix of green/yellow/orange/red on the dashboard.
    let daysSinceLastContact: number;
    if (status === "LAPSED") daysSinceLastContact = Math.floor(Math.random() * 300) + 200;
    else if (i < 8) daysSinceLastContact = Math.floor(Math.random() * 60); // green
    else if (i < 16) daysSinceLastContact = Math.floor(Math.random() * 90) + 90; // yellow
    else daysSinceLastContact = Math.floor(Math.random() * 90) + 180; // orange

    const numDonations = status === "MAJOR_DONOR" ? Math.floor(Math.random() * 4) + 5 : Math.floor(Math.random() * 4) + 2;
    const donationDates: number[] = [];
    for (let j = 0; j < numDonations; j++) {
      donationDates.push(Math.floor(Math.random() * firstGiftDaysAgo));
    }
    donationDates.sort((a, b) => a - b);
    const lastGiftDays = donationDates[donationDates.length - 1];

    const person = await prisma.person.create({
      data: {
        centerId: centers[center],
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase().replace(/'/g, "")}@email.com`,
        phone: `555-${String(2000 + i).padStart(4, "0")}`,
        donorStatus: status,
        givingFrequency: pick(FREQS),
        notes: pick(DONOR_NOTES),
        lastContactAt: daysAgo(daysSinceLastContact),
        convertedToDonorAt: daysAgo(firstGiftDaysAgo),
      },
    });

    let lifetime = 0;
    let ytd = 0;
    let lastYear = 0;
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);

    for (const dDays of donationDates) {
      const baseAmount = status === "MAJOR_DONOR" ? 500 + Math.floor(Math.random() * 4500) : 50 + Math.floor(Math.random() * 750);
      const amount = Math.round(baseAmount / 5) * 5;
      const date = daysAgo(dDays);
      const campaignName = pick(CAMPAIGN_NAMES);
      await prisma.donation.create({
        data: {
          personId: person.id,
          centerId: person.centerId,
          date,
          amount: new Prisma.Decimal(amount),
          paymentMethod: pick(PAYMENTS),
          campaignId: campaigns[campaignName],
          receiptSent: true,
          thankYouSent: Math.random() > 0.2,
          source: "MANUAL",
        },
      });
      lifetime += amount;
      if (date >= yearStart) ytd += amount;
      else if (date >= lastYearStart) lastYear += amount;
      donationCount++;
    }

    await prisma.person.update({
      where: { id: person.id },
      data: {
        lifetimeAmount: new Prisma.Decimal(lifetime),
        ytdAmount: new Prisma.Decimal(ytd),
        lastYearAmount: new Prisma.Decimal(lastYear),
        lastDonationAt: daysAgo(lastGiftDays),
      },
    });

    // 2-5 contacts
    const numContacts = Math.floor(Math.random() * 4) + 2;
    for (let j = 0; j < numContacts; j++) {
      await prisma.contact.create({
        data: {
          personId: person.id,
          centerId: person.centerId,
          date: daysAgo(daysSinceLastContact + j * 30),
          contactType: pick(CONTACT_TYPES),
          outcome: pick(OUTCOMES),
          staffUserId: staffByName[pick(staffNames)],
          notes: "Donor relationship touchpoint.",
        },
      });
      contactCount++;
    }
    donorCount++;
  }

  console.log(`  ✓ ${donorCount} donors`);
  console.log(`  ✓ ${donationCount} donations`);
  console.log(`  ✓ ${contactCount} contacts`);

  return { org, director, prospectCount, donorCount, donationCount, contactCount };
}
