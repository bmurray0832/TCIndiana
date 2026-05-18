# TCIndiana CRM — Bloomerang Replacement

## 1. Overall objective

Replace Bloomerang for Teen Challenge Indiana with a single web app that does
what Bloomerang can't: **track prospects through a sales-style pipeline, then
keep them engaged as donors after they give for the first time.** The
spreadsheet `nonprofit_crm_v2_final.xlsm` already captures ~90% of the
intended workflow; this app is the production version of that spreadsheet,
plus online giving and basic email/import integrations.

Three audiences, one tool:

- **Center staff** (one user per center, sometimes more) — work the daily
  follow-up queue, log contacts, record gifts, see who's slipping.
- **Center director** — see their center's pipeline health, biggest
  supporters, and lapsed donors at a glance.
- **Org leadership (TC Indiana HQ)** — roll up all centers, compare,
  forecast.

Success looks like: a staff member opens the app in the morning, sees the
five people they need to contact today (color-coded by urgency), logs the
calls/emails, and the system updates the queue, the dashboard, and the
monthly report automatically. No one re-opens the Excel file.

## 2. Why this isn't Bloomerang

| Need | Bloomerang | This app |
| --- | --- | --- |
| Track existing donors | ✅ | ✅ |
| Track **prospects** (not yet given) | ❌ | ✅ — first-class entity with Hot/Warm/Cold rating and pipeline stages |
| Sales-style next-step queue | ❌ | ✅ — Follow-Up Queue + per-record "Next Step" field |
| Days-since-contact alerts (Green/Yellow/Orange/Red) | partial | ✅ — drives the whole dashboard |
| Multi-center segmentation | weak | ✅ — every record belongs to a Center, users scoped per Center |
| Online giving with center designation | extra cost | ✅ — Stripe, fund/center routed automatically |
| Customizable for TC's specific workflow | locked | ✅ — it's ours |

## 3. Stack and shape

Mirror holy-insights so we can lift patterns and components straight over:

- **Next.js (App Router) + TypeScript + Tailwind v4**
- **Prisma + Postgres** (Railway)
- **Auth0** for staff auth
- **Stripe** for online giving (Payment Element + Subscriptions + Webhooks)
- **Resend** for transactional mail (receipts, thank-yous)
- **Microsoft Graph + Gmail API** for the "send + log" feature
- **Recharts** for reports, **Lucide** icons, **react-hook-form + zod**

Repo: new app in `bmurray0832/TCIndiana`. Not a holy-insights module — the
two products will diverge.

## 4. Tenant model

```
TC Indiana (Organization)
├── Main Center
├── Center 2
├── Center 3
├── …
└── Center N

User
└── UserCenterRole[] (a user can belong to multiple centers)
```

Roles per center: `staff`, `director`, `viewer`. An `org_admin` role on the
Organization sees all centers.

Every Donor, Prospect, Contact, Donation, and FollowUp row has a `centerId`.
Every list query filters by the user's accessible centers.

## 5. Data model (mapped from the spreadsheet)

Spreadsheet sheet → Prisma model:

### `Center`
`id, organizationId, name, slug, address, brandColor, brandLogoUrl, stripeAccountId (Connect), donationPageSlug, createdAt`

### `Person` (shared base for Donor + Prospect)
A constituent is one row whether or not they've given yet. "Prospect" vs.
"Donor" becomes a derived status — a Prospect becomes a Donor the moment
their first Donation is recorded. This collapses the spreadsheet's two
tabs into one entity, which avoids the data drift the spreadsheet has
(same person listed twice when they convert).

```
Person
  id, centerId, firstName, lastName, email, phone, organization,
  preferredContact (Email|Phone|Mail|In-Person|Text),
  source (Event|Referral|Walk-in|Online|Social Media|Email Campaign|Annual Gala|Community Event|Other),
  interestLevel (Hot|Warm|Cold | null after conversion),
  donorStatus (Active|Lapsed|Major Donor | null until first gift),
  givingFrequency (One-time|Monthly|Quarterly|Annual|Irregular),
  nextStep (free text + dropdown),
  notes,
  dateAdded, lastContactAt, lastDonationAt,
  // computed/cached
  daysSinceContact, alertColor (Green|Yellow|Orange|Red),
  lifetimeAmount, ytdAmount, lastYearAmount,
  convertedToDonorAt
```

Page-level filters on the same table give us a "Prospects" view (where
`convertedToDonorAt IS NULL`) and a "Donors" view (where it's not null).
Both views share search, alert logic, and detail pages.

### `Contact` (Contact Log)
`id, personId, centerId, date, contactType (Phone Call|Email|In-Person Meeting|Event|Mail|Text Message), staffUserId, outcome (Made Donation|Scheduled Follow-up|No Answer|Left Message|Not Interested|Information Sent|Other), donationId (nullable, set if outcome was Made Donation), notes, nextFollowUpAt, createdAt`

### `Donation`
`id, personId, centerId, date, amount, campaignId, paymentMethod (Check|Credit Card|Cash|Online|Bank Transfer), receiptSent, thankYouSent, source (manual|stripe|imported), stripeChargeId, stripeSubscriptionId, notes`

### `Campaign` (= Campaign Purpose in the spreadsheet)
`id, centerId (nullable for org-wide), name (General Fund|Capital Campaign|Program Support|Emergency Relief|…), description, goalAmount, startDate, endDate, active`

### `FollowUp`
Materialized table refreshed by a cron job (and on write). Pulls every
Person whose `alertColor != Green` plus every Contact with `nextFollowUpAt
<= now`. Keeps the queue fast and gives us a place to store
priority/snoozed/dismissed state without polluting Person.

### `User`, `UserCenterRole`, `AuditLog`
Standard auth + org/center membership. AuditLog tracks any write — useful
for "who changed this donor's status."

### Reference data → enums or small lookup tables
Staff list, contact types, donor statuses, prospect interest, contact
methods, sources, payment methods, campaigns, outcomes, centers, giving
frequencies. The spreadsheet's Reference Data tab becomes either enums
(if fixed) or per-organization lookup tables (if the center wants to add
options).

## 6. The alert engine (the heartbeat)

The Green/Yellow/Orange/Red logic in the spreadsheet is what makes the
dashboard useful. Replicate it server-side and compute it on every read:

| Color | Donor (has given) | Prospect (hasn't given) |
| --- | --- | --- |
| Green | < 90 days since last contact | < 14 days |
| Yellow | 90–180 days | 14–30 days |
| Orange | 180–365 days | 30–60 days |
| Red | > 365 days | > 60 days |

Thresholds configurable in Settings (every center has different rhythms
— a Major Donor's threshold should be tighter than a Lapsed donor's).
Stored as JSON on two levels:

- `Organization.defaultAlertThresholds` — set by **org_admin** (HQ),
  applies to every center that hasn't overridden.
- `Center.alertThresholds` — set by **center director** for their own
  center, overrides the org default.
- **Staff** can see thresholds but not edit them.

Same pattern holy-insights uses for church-admin vs. campus-admin.

The dashboard, follow-up queue, and "Donors Needing Attention" widget all
key off this single computation.

## 7. Pages / views

Each page is mocked here at the level of "what's on it" — enough to
build, not enough to lock UX choices. Mirror holy-insights component
naming where it applies (`KpiCard`, `DrilldownModal`, `Sidebar`, etc).

### `/` Dashboard (per-center, with org rollup if `org_admin`)
- **KPI strip**: Donors, Prospects, YTD $, Avg gift, Contacts this month,
  Red Donors, Red Prospects (copy of the spreadsheet's KEY METRICS row)
- **Donors Needing Attention** — list of Red/Orange donors with one-click
  "Log Contact" action
- **Prospects Going Cold** — same for Red/Orange prospects
- **This Week's Follow-Ups** — items from the queue due in the next 7 days
- **Recent Donations** feed
- **Mini chart**: contacts logged per week (8-week trend) so directors can
  see whether the team is keeping up cadence

### `/prospects`
- Table with filters: Interest (Hot/Warm/Cold), Source, Alert color, Center
- Search by name/email/phone
- Bulk actions: assign center, change interest, mark converted, export
- "Kanban" toggle: columns by Hot/Warm/Cold, cards draggable between
  stages (sales-process feel)
- Row click → `/prospects/[id]`

### `/prospects/[id]` and `/donors/[id]`
Shared `PersonProfile` component. Tabs:
- **Overview** — contact info, status, source, next step, alert
- **Activity** — chronological Contact Log entries (newest first)
- **Giving** — donations table (empty for prospects until first gift)
- **Files & notes** — long-form notes, attachments (later phase)
- **Quick actions** — Log Contact, Send Email, Add Donation, Schedule
  Follow-Up — all open modals

Converting a prospect: "Add Donation" on a prospect record automatically
sets `convertedToDonorAt` and `donorStatus = Active`. No separate "convert"
button needed — the act of giving converts them.

### `/donors`
Same table machinery as `/prospects`, filtered to converted people.
Default columns mirror the spreadsheet: Status, Giving Freq, Lifetime,
This Year, Last Year, YoY Change, Last Don, Last Contact, Alert.
Sortable by lifetime desc to find "biggest supporters" fast — this is the
view a center director will live in.

### `/contacts`
Full Contact Log feed. Same date filters as the spreadsheet. Each row
links to the Person and the related Donation if any.

### `/donations`
- Filters: date range, campaign, payment method, source (manual vs stripe)
- "Add Donation" modal (autocompletes Person from the people table)
- Receipt/Thank You status columns with one-click toggles
- Reconciliation tab: any Stripe charge that didn't auto-match a Person
  lands here for staff to assign

### `/follow-ups` (the Follow-Up Queue)
- Priority-sorted to-do list
- Filter by Center / Staff / Alert color
- Each row: name, type (donor/prospect), days out, alert, "Action" button
  that opens Log Contact modal pre-filled
- Snooze / dismiss / mark done

### `/reports`
A few specific reports up front:
- **Monthly Donation Report** (replicates the spreadsheet's tab) — picker
  for month + center
- **Campaign performance** — $ by campaign, by month
- **Donor retention** — what % of last year's donors gave this year
- **YoY by center**
- **Pipeline funnel** — Cold → Warm → Hot → Donor conversion rates
- **"Biggest supporters"** — top N donors by lifetime, with last-contact
  recency overlay (the exact view a director wants for a board meeting)

All reports export to CSV/PDF; some embed a Recharts chart.

### `/give/[centerSlug]` — public donation page (no auth)
Branded per center. Lives on `tcindiana.org/give/[centerSlug]` as a
subpath (not a separate domain) — keeps the main TC Indiana site's
SEO and branding. See section 8.

### `/portal` — donor portal (donor auth, separate from staff)
See section 8.

### `/import` (org_admin only)
Bloomerang CSV mapper. See section 9.

### `/settings`
- Centers (add/edit, brand color, donation page slug)
- Staff users + per-center roles
- Reference lists (campaigns, sources, outcomes…)
- Alert thresholds per center
- Stripe Connect status
- Email integration (connect Outlook / Gmail per user)
- Receipt / thank-you email templates

## 8. Online giving — deep dive

Bloomerang charges extra for online giving and locks the data into their
platform. Replacing that piece is half the value of this project.

### Donor experience
- Public URL `tcindiana.org/give/main-center` (or `…/give` with center
  selector if they prefer one URL)
- One page, mobile-first, branded with the center's logo and color
- Amount: preset buttons ($25 / $50 / $100 / $250 / $500 / custom)
- Frequency: One-time, Monthly, Quarterly, Annual (maps to the
  spreadsheet's `Giving Frequency`)
- **Fund / Campaign** dropdown (General Fund, Capital Campaign, Program
  Support, Emergency Relief) — auto-populated from active Campaigns
- **Designate to a specific center** (if landed on the org-level page)
- "I'd like to cover the processing fee" toggle — common nonprofit
  pattern, recovers ~3% on average
- Tribute / memorial giving: "In honor of…" / "In memory of…" with
  optional notification email to a third party
- Payment methods via Stripe Payment Element: card, Apple Pay, Google
  Pay, Link, **ACH** (Plaid-linked — important for large recurring gifts;
  ACH fees are flat, card fees are %)
- Receipt email sent immediately (Resend), IRS-compliant language ("no
  goods or services received")
- Optional follow-up thank-you email 24h later from the donor's assigned
  staff member's address

### Behind the scenes
1. Public page calls a route handler that creates a Stripe Checkout
   Session **or** a PaymentIntent + (if recurring) a Subscription.
   Metadata: `centerId`, `campaignId`, `coverFees`, `tribute`,
   `prospectiveDonorId` (if we recognize the email).
2. Stripe webhook handler (`/api/stripe/webhook`) processes:
   - `payment_intent.succeeded` → create/update Person (match by email),
     insert Donation, mark Receipt=Yes, queue thank-you task
   - `invoice.payment_succeeded` (recurring) → insert Donation for that
     month/quarter/year
   - `customer.subscription.created/updated/deleted` → update Person's
     `givingFrequency` and store the Stripe Subscription ID
   - `charge.refunded` → set Donation to refunded, recompute lifetime
3. Email match → existing Person: attach. No match → create new Person
   with `convertedToDonorAt = now`, `source = Online`. Either way, log a
   Contact with `contactType = Online`, `outcome = Made Donation`.
4. If a Prospect gives, the conversion happens automatically and a
   dashboard celebration alert fires ("🎉 P007 Rebecca Perry just
   converted — \$500 to Capital Campaign").

### Donor portal (`/portal`)
- Donor logs in with email magic-link (separate auth flow from staff)
- Sees: giving history, year-end statement download, current recurring
  schedule
- Can: update payment method, change recurring amount/frequency, cancel
  recurring, switch fund

### Stripe Connect vs single account?
Two options, decide after discovery: a single Stripe account for TC
Indiana with fund-based reporting (simpler, all centers share), **or**
Stripe Connect where each center is a connected account (each center
sees its own Stripe dashboard, payouts route directly).

**Discovery needed:** what does TC Indiana use for payment processing
today? (May be Bloomerang's built-in, may be a separate Stripe/Square
account, may be paper-only.) Three things to find out before Phase 3:

1. Current processor + monthly volume — affects fee negotiation
2. How recurring donors are billed today — those subscriptions need to
   migrate without re-asking each donor for their card
3. Whether each center has its own bank account or they all share one
   — single shared bank = single Stripe account is fine; separate bank
   accounts = Connect is worth the complexity

Recommend starting with a single account and only moving to Connect if
discovery surfaces separate bank accounts per center.

### Fees and reporting
Show staff:
- Gross gift vs. net (after Stripe fees) per donation
- Whether donor covered fees
- A "Stripe fees YTD" line in the monthly report so directors aren't
  surprised at year-end

## 9. Bloomerang import

One-time but re-runnable. Bloomerang exports three CSVs:

1. **Constituents** — name, contact info, status → maps to Person
2. **Transactions** — gifts → maps to Donation
3. **Interactions** — calls/emails/visits → maps to Contact

`/import` flow:
1. Upload CSV(s)
2. Column-mapper UI (autoguess, then confirm; remember mappings)
3. Dry-run: show "120 new constituents, 5 conflicts (matched by email but
   name differs)"
4. Conflict resolution: merge / create new / skip per row
5. Commit. Persist a `BloomerangImport` record with counts so a re-run
   can de-dupe by external Bloomerang ID.

Lifetime totals should be computed from imported Donations, not taken
from a Bloomerang summary field — that way the math agrees with what the
app shows going forward.

## 10. Email send + log

Each staff user connects their Outlook (Microsoft Graph) or Gmail (Gmail
API) account in Settings. OAuth, no SMTP credentials stored.

- "Send Email" action on a Person opens a composer pre-filled with
  templates (intro, follow-up, thank-you). Send goes through the staff
  member's mailbox so replies land in their inbox naturally.
- Every sent email writes a Contact row (`contactType = Email`,
  `staffUserId = sender`, body in `notes`).
- Optional: subscribe to inbound-mail webhooks (Graph subscriptions /
  Gmail Pub/Sub) so replies from Persons we know auto-create Contact
  entries. Start without this — it's a phase-2 nice-to-have.

## 11. Reports the centers actually need

Talking to a center director, the questions they ask repeatedly:

- "Who are my top 25 donors and when did I last talk to them?" →
  Donors sorted by lifetime desc with alert color overlay
- "Who gave last year but not this year?" → Lapsed donor report
- "Which campaign is on track this quarter?" → Campaign goal vs. actual
- "How is my pipeline looking?" → Funnel: # Cold / # Warm / # Hot /
  conversions in last 90 days
- "How is my staff doing on follow-up?" → Contacts logged per
  staffUserId per week
- "What's the year-end push look like?" → Donations + projected
  recurring through Dec 31

Each report is one page with filters at the top, KPIs strip, one chart,
one drilldown table, CSV/PDF export.

## 12. Phased rollout

**Phase 0 — Foundation (1–2 weeks)**
- Repo bootstrap (Next.js + Prisma + Auth0 + Railway + Tailwind),
  copy the holy-insights `AppShell` / `Sidebar` / `KpiCard` patterns.
- Center + User + UserCenterRole + Org models.
- Login, center switcher, basic empty pages.

**Phase 1 — Excel parity (3–4 weeks)** *(this is the MVP)*
- Person, Contact, Donation, Campaign, FollowUp models + CRUD.
- Alert engine.
- Dashboard, Prospects, Donors, Contacts, Donations, Follow-Up Queue,
  Monthly Report.
- Seed data import script that loads the existing spreadsheet.

**Phase 2 — Get off Bloomerang (2 weeks)**
- Bloomerang CSV importer with mapper UI.
- Run on production data; reconcile lifetime totals.
- Cutover plan: staff use both systems for 2 weeks, then read-only on
  Bloomerang, then off.

**Phase 3 — Online giving (3–4 weeks)**
- Stripe Connect / single-account decision.
- `/give/[centerSlug]` page with recurring, ACH, cover-fees, tribute,
  fund routing.
- Webhook → Donation pipeline.
- Donor portal (`/portal`).
- IRS-compliant receipts via Resend.

**Phase 4 — Email send + log (1–2 weeks)**
- Microsoft Graph + Gmail OAuth per user.
- Composer, templates, auto-logging.

**Phase 5 — Advanced reports + automation (ongoing)**
- Retention, lapsed re-engagement, top supporters
- Scheduled emails ("you haven't talked to Patricia Chen in 70 days"
  sent to her assigned staff on Monday mornings)
- Segmentation / saved views

## 13. Build philosophy: plan wide, build narrow

The data model and page list in this doc are intentionally complete —
all the way through online giving, donor portal, and reports — because
shaping the schema correctly on day one is cheap, and reshaping it after
six months of production data is expensive.

What we **build** at any given time is just the current phase. Phase 1
ships before anyone touches Stripe code. The unbuilt tables stay in the
schema as `// Phase 3` or `// Phase 4` comments so the migration path is
already known but no work is wasted on features staff haven't asked for.

Practical rule: only build a feature once a current user is blocked
without it. Until then, the value is in the plan, not in the code.

## 14. Resolved decisions

- ✅ **Donation page URL**: subpath on `tcindiana.org/give/[centerSlug]`,
  not a separate domain
- ✅ **Alert threshold ownership**: HQ (org_admin) sets org defaults;
  center directors override for their own center; staff read-only
- ✅ **Roles model**: HQ-controlled + center-leader override pattern,
  mirroring holy-insights' church-admin / campus-admin split

## 15. Open questions to resolve

**Before Phase 3 (online giving):**
- What payment processor does TC Indiana use today? (Discovery item —
  needed to plan recurring-donor migration without re-asking each
  donor for a card.)
- Do centers share a bank account or have separate ones? (Drives
  Stripe single-account vs. Connect.)
- Donor portal auth: magic link, Google, or both?

**Before Phase 2 (Bloomerang import):**
- Beyond the spreadsheet's fields, what does TC track in Bloomerang
  today? Specifically: spouse / household giving, separate mailing vs.
  physical addresses, soft credits, board / committee membership,
  custom tags. (Discovery item with whichever staff member runs
  Bloomerang today.)

## 16. Out of scope (for now)

- Event ticketing / event RSVP (Bloomerang has it; not in the
  spreadsheet)
- Peer-to-peer fundraising pages
- Text-to-give shortcodes (can layer on later via Twilio)
- Volunteer hour tracking (could share infra with holy-insights later)
- Grants / foundation pipeline (different workflow; revisit after MVP
  is in use)

---

The spreadsheet is doing this job today, manually. Everything above is
about making the same workflow faster, multi-user, and able to take
donations directly — without changing what the staff already know.
