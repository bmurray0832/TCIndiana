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
| 0.5 | ✅ done | Auth0 with dev-mode fallback |
| 1 | ✅ done | Write paths: log contact, add donation, add/edit person; Monthly Report |
| 1.5 | ✅ done | Follow-up snooze, Campaign Performance, Biggest Supporters, Retention, Pipeline Funnel, YoY by Center reports |
| 2 | ✅ done | Bloomerang CSV importer (Constituents / Transactions / Interactions) |
| 2.5 | ✅ done | User + Center admin UI |
| 3 | ✅ done | Stripe online giving (one-time + monthly, ACH, cover-fees) |
| 4 | ✅ done | Email send + log via Resend (shared sender) |
| 3.5 | ✅ done | Donor self-service portal (magic-link auth + Stripe Customer Portal) |
| 4.5 | ✅ done | Per-user Outlook OAuth (send as me); Gmail pending in 4.6 |
| 5 | ✅ done | Scheduled cron: weekly digest + monthly lapsed-donor email |
| 4.6 | later | Gmail OAuth equivalent of 4.5 |
| 4.7 | later | Inbound auto-log of email replies via Graph subscriptions |

## Auth0

When all four `AUTH0_*` env vars are set (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`,
`AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`) plus `APP_BASE_URL`, the app uses
Auth0. Sign-in goes through `/auth/login`, callback at `/auth/callback`,
sign-out at `/auth/logout` — all owned by the SDK via `src/middleware.ts`.

User provisioning: on first sign-in the SDK gives us a `sub` and `email`.
We look up an existing `User` by email (seeded or imported), stamp the
Auth0 `sub` onto the row, and treat them as that user thereafter. If no
`User` row exists, the user lands on `/access-pending` and an admin
must create them.

When Auth0 env vars are unset and `NODE_ENV !== "production"`, the app
falls back to the dev shim (`DEV_USER_EMAIL`). In production with Auth0
unset, `getCurrentUser()` returns null and the app refuses to serve.

## Online giving

When `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set:

- `/give` — public landing, picks a center
- `/give/[centerSlug]` — branded per-center donation page with preset
  amounts, custom amount, one-time / monthly, fund selector, tribute
  field, and a "cover the processing fee" toggle
- Submits to `/api/give/checkout` which creates a Stripe Checkout
  Session (card + ACH) and redirects the donor to Stripe-hosted payment
- Webhook at `/api/stripe/webhook` handles `checkout.session.completed`
  (one-time), `invoice.payment_succeeded` (recurring), `charge.refunded`
- On success: match Person by email + center → create Donation
  (`source=STRIPE`) → log a Contact (`outcome=MADE_DONATION`) → run
  `recomputePerson()`. Donors created from online gifts get
  `source=ONLINE` and `convertedToDonorAt=now`.

Without those env vars, the donation page renders an "Online giving
isn't live yet" notice. Gifts can still be entered manually from the
staff app.

## Donor portal

`/portal/request` accepts an email and sends a magic-link sign-in via
Resend (or surfaces the link inline in dev). One-hour token, 30-day
session cookie. `/portal` shows lifetime/YTD/gift history; donors who
have an online gift on file get a button that hands off to the
Stripe-hosted Customer Portal for card / subscription management.

## Per-user mail integration

Settings → Email integrations lets each staff member connect their
Outlook account once. When connected, the "Send email" composer routes
through Microsoft Graph (`/me/sendMail`), so the email comes from their
address and replies land in their inbox. Access tokens refresh
automatically before each send. Without a connection, the composer
falls back to the shared Resend account.

## Scheduled emails

Two cron jobs (Railway-managed via `railway.toml`):

- **`/api/cron/weekly-digest`** — Monday 9 AM ET. For every active
  user, builds a list of the 10 people in their accessible centers who
  most need a touch (any non-green alert, sorted by lifetime giving)
  and sends a plain-text email with deep links to each profile.
- **`/api/cron/lapsed-donors`** — 1st of the month at 10 AM ET. Per
  organization, emails the top 25 lapsed donors (12+ months no gift or
  status=Lapsed) to every org admin.

Both routes require `Bearer ${CRON_SECRET}` in production; without the
env var they're open for dev access. Uses Resend; when unconfigured,
the cron logs to console and returns a skipped count instead.

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
