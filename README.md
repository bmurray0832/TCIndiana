# TCIndiana CRM

A nonprofit CRM for Teen Challenge Indiana — replacing Bloomerang with a
tool that tracks **both prospects and donors** through a sales-style
pipeline, supports multiple centers, and (Phase 3) accepts online
giving directly.

Built from the workflow in `nonprofit_crm_v2_final.xlsm`. See
[`docs/PLAN.md`](docs/PLAN.md) for the full design.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Prisma + Postgres ·
Lucide icons. Stripe / Resend / Auth0 land in later phases.

## Running locally

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit DATABASE_URL to point at a Postgres instance.

# 3. Create schema
npx prisma migrate dev --name init

# 4. Seed from the spreadsheet
# Drop nonprofit_crm_v2_final.xlsm at the repo root (or set CRM_XLSX_PATH).
npm run db:seed

# 5. Run
npm run dev
# → http://localhost:3000
```

You'll land on `/dashboard` as the seeded `director@tcindiana.org`
(ORG_ADMIN, sees all centers). Change `DEV_USER_EMAIL` in `.env` to
sign in as a different seeded user.

## What's built (Phase 0 + start of Phase 1)

- Prisma schema for the full Phase 1 data model — Organization,
  Center, User, UserCenterRole, Person (donors + prospects collapsed),
  Contact, Donation, Campaign, FollowUp, AuditLog. Phase 3/4 fields
  stubbed in-place.
- Green/Yellow/Orange/Red alert engine (`src/lib/alerts.ts`) with
  HQ-default + per-center override.
- Seed script that loads the workbook into Postgres.
- Pages: Dashboard, Donors, Prospects, Person detail (shared profile
  with contact history + giving table), Contact Log, Donations,
  Follow-Up Queue, Reports (placeholder list), Settings (read-only).
- Sidebar / AppShell / KpiCard / AlertBadge components.

## What's next

| Phase | Status | Scope |
| --- | --- | --- |
| 0 | ✅ done | Bootstrap, schema, seed, read-only pages |
| 1 | ✅ done | Write paths: log contact, add donation, add/edit person; Monthly Report |
| 2 | ✅ done | Bloomerang CSV importer (Constituents / Transactions / Interactions) |
| 0.5 | next | Swap dev auth shim for Auth0 |
| 1.5 | later | Follow-up snooze/done, campaign + retention reports |
| 3 | later | Stripe online giving + donor portal |
| 4 | later | Outlook + Gmail email-send/log |
| 5 | later | Automations |

## Bloomerang import

`/import` is a one-time CSV importer. Three sub-tools, run in order:

1. **Constituents** → People (donors and prospects). Pick a center; all
   rows in the file get assigned to it. Idempotent on `Constituent ID`.
2. **Transactions** → Donations. Matched to the person by Constituent
   ID. Idempotent on `Transaction ID`. Auto-creates campaigns by name.
3. **Interactions** → Contact Log entries. Matched by Constituent ID.

Each tool: upload CSV → confirm column mapping (auto-detected, editable)
→ dry-run preview (created / updated / skipped / errors) → commit.
History of imports is shown on the landing page.

## Layout

```
src/
  app/
    (app)/            authed pages with sidebar
      dashboard/
      donors/
      prospects/
      people/[id]/
      contacts/
      donations/
      follow-ups/
      reports/
      settings/
    layout.tsx
    page.tsx          → redirects to /dashboard
    globals.css
  components/         AppShell, Sidebar, KpiCard, AlertBadge, PeopleTable, PageHeader
  lib/
    prisma.ts         client singleton
    queries.ts        server-side data fetchers (centre-scoped)
    alerts.ts         the Green/Yellow/Orange/Red engine
    auth-dev.ts       dev auth shim — replace with Auth0 in Phase 0.5
    utils.ts          cn, formatDate, formatCurrency
    colors.ts         alert / interest / status colour tokens
  generated/prisma/   Prisma client output (gitignored)
prisma/
  schema.prisma
  seed.ts             loads nonprofit_crm_v2_final.xlsm
docs/
  PLAN.md             the source of truth for what we're building
```
