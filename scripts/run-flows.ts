/** End-to-end interaction demo:
 *  1. Open a Red prospect → log a contact → watch the alert flip to green
 *  2. Open a different Red prospect → add a donation → watch the
 *     prospect → donor conversion + lifetime/YoY update
 *  3. Open the follow-up queue → snooze someone → watch them disappear
 */

import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "preview-screenshots/flows");
fs.mkdirSync(OUT, { recursive: true });

async function shot(page: Page, name: string, note?: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`  📸 ${name}${note ? "  — " + note : ""}`);
}

async function findFirstRedRow(page: Page): Promise<string> {
  // The table renders one <tr> per person; the alert badge contains "Red".
  // We click the name link in the first row whose alert badge says Red.
  const rows = page.locator("tbody tr").filter({ hasText: "Red" });
  const first = rows.first();
  await first.waitFor();
  const name = await first.locator("td").first().innerText();
  await first.locator("a").first().click();
  return name.split("\n")[0];
}

(async () => {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  console.log("\n=== FLOW 1: Log a contact ===\n");
  await page.goto("http://localhost:3000/prospects", { waitUntil: "networkidle" });
  await shot(page, "flow1-01-prospects-list", "15 prospects, most Red because they haven't been contacted recently");

  const targetName = await findFirstRedRow(page);
  await page.waitForLoadState("networkidle");
  await shot(page, "flow1-02-profile-before", `${targetName} — Red alert, contact history visible`);

  await page.getByRole("button", { name: /Log contact/i }).click();
  await page.waitForSelector('[role="dialog"]');
  await shot(page, "flow1-03-modal-open", "Log Contact modal, defaults to today + Phone Call");

  await page.selectOption("#contactType", "PHONE_CALL");
  await page.selectOption("#outcome", "SCHEDULED_FOLLOW_UP");
  await page.fill("#notes", "Called to introduce TC Indiana's recovery program. They're interested — sending a brochure and scheduling a campus tour for next week.");
  await page.fill("#nextFollowUpAt", "2026-05-26");
  await shot(page, "flow1-04-modal-filled", "Form filled — phone call, scheduled follow-up, real notes");

  await page.getByRole("button", { name: /^Log contact$/i }).click();
  await page.waitForSelector('[role="dialog"]', { state: "detached" });
  await page.waitForLoadState("networkidle");
  await shot(page, "flow1-05-profile-after", "Same profile — new contact at top of history, Days Since reset to 0, alert flipped to Green");

  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await shot(page, "flow1-06-dashboard-updated", "Dashboard — contacts/month KPI bumped by 1, person no longer in needing-attention");

  console.log("\n=== FLOW 2: Convert a prospect by recording their first gift ===\n");
  await page.goto("http://localhost:3000/prospects", { waitUntil: "networkidle" });
  await shot(page, "flow2-01-prospects-before", "Prospects list — note the count");

  // Find a "Hot" prospect for a satisfying demo.
  const hotRow = page.locator("tbody tr").filter({ hasText: "HOT" }).first();
  const hotName = await hotRow.locator("td").first().innerText();
  await hotRow.locator("a").first().click();
  await page.waitForLoadState("networkidle");
  await shot(page, "flow2-02-prospect-profile", `${hotName.split("\n")[0]} — currently a HOT prospect, no donations yet`);

  await page.getByRole("button", { name: /Add donation/i }).click();
  await page.waitForSelector('[role="dialog"]');
  await shot(page, "flow2-03-donation-modal-open", "Add Donation modal — preset to today, Check by default");

  await page.fill("#amount", "5000");
  await page.selectOption("#paymentMethod", "CREDIT_CARD");
  // Pick the first available campaign
  await page.evaluate(() => {
    const sel = document.querySelector<HTMLSelectElement>("#campaignId");
    if (sel && sel.options.length > 1) sel.value = sel.options[1].value;
    sel?.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.fill("#notes", "First gift! Met at last week's gala — went straight to capital campaign.");
  await page.locator('input[name="receiptSent"]').check();
  await page.locator('input[name="thankYouSent"]').check();
  await shot(page, "flow2-04-donation-filled", "$5,000 to Capital Campaign, receipt + thank-you marked sent");

  await page.getByRole("button", { name: /^Record donation$/i }).click();
  await page.waitForSelector('[role="dialog"]', { state: "detached" });
  await page.waitForLoadState("networkidle");
  await shot(page, "flow2-05-profile-now-donor", "Same person — now shown as Donor, lifetime $5,000, donation in history");

  await page.goto("http://localhost:3000/donors", { waitUntil: "networkidle" });
  await shot(page, "flow2-06-donors-list", "Donors list — count is now 28 (was 27), new donor at the top");

  await page.goto("http://localhost:3000/donations", { waitUntil: "networkidle" });
  await shot(page, "flow2-07-donations-list", "Donations list — new $5,000 gift at top");

  console.log("\n=== FLOW 3: Snooze someone from the follow-up queue ===\n");
  await page.goto("http://localhost:3000/follow-ups", { waitUntil: "networkidle" });
  await shot(page, "flow3-01-queue-before", "Follow-up queue — sorted by alert severity then lifetime");

  // Hit the first Snooze button
  const firstSnooze = page.getByRole("button", { name: /^Snooze$/i }).first();
  const targetRowName = await firstSnooze.locator("xpath=ancestor::tr").locator("td").first().innerText();
  await firstSnooze.click();
  await shot(page, "flow3-02-snooze-menu", `Snooze dropdown open — ${targetRowName.split("\n")[0]} about to be snoozed 30 days`);

  await page.getByRole("button", { name: /30 days/i }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await shot(page, "flow3-03-queue-after", "Queue refreshed — that person is gone (alert flipped to Green via snoozedUntil)");

  console.log("\n✓ Done. Screenshots in", OUT);
  await browser.close();
})();
