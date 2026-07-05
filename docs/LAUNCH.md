# Launch Plan — go live this week

The codebase is feature-complete for launch (all phases through 5 built;
`npm run typecheck` and `npm run build` pass). What remains is deployment,
configuration, and data — no feature work.

**Launch scope decided:** live in production for you + a few staff across
1–2 centers, real Bloomerang data, staff email via Resend. **Online giving
is deferred** — Stripe is on hold pending a payment-platform decision; the
`/give` pages already degrade gracefully to an "online giving isn't live
yet" notice when Stripe env vars are unset, so nothing breaks.

## Day 1 — Deploy

1. **Create a `main` branch.** The repo currently has only working
   branches. Merge the current branch into `main` and set it as the
   default branch on GitHub; point Railway at it.
2. **Railway project**: add the repo as a service next to the existing
   Postgres. `railway.toml` now runs `prisma migrate deploy` before each
   deploy goes live, so the schema stays current automatically.
3. **Set environment variables** on the Railway service:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Railway Postgres reference (`${{Postgres.DATABASE_URL}}`) |
   | `APP_BASE_URL` | the public URL, e.g. `https://crm.tcindiana.org` (or the Railway-generated domain to start) |
   | `AUTH0_DOMAIN` | from the Auth0 application |
   | `AUTH0_CLIENT_ID` | from the Auth0 application |
   | `AUTH0_CLIENT_SECRET` | from the Auth0 application |
   | `AUTH0_SECRET` | `openssl rand -hex 32` |
   | `RESEND_API_KEY` | from Resend |
   | `RESEND_FROM_ADDRESS` | `TC Indiana <hello@tcindiana.org>` (verified domain) |
   | `CRON_SECRET` | `openssl rand -hex 32` — protects the cron endpoints |

   Do **not** set `DEV_USER_EMAIL` (dev-only) or the `STRIPE_*` vars
   (giving is deferred). `MS_GRAPH_*` is optional — see Day 4.
4. **Auth0 application settings**: Allowed Callback URLs →
   `${APP_BASE_URL}/auth/callback`; Allowed Logout URLs → `${APP_BASE_URL}`.
5. **Bootstrap the database** (from your machine, with `DATABASE_URL`
   pointed at the production Postgres):

   ```bash
   BOOTSTRAP_ADMIN_EMAIL=you@tcindiana.org \
   BOOTSTRAP_ADMIN_NAME="Your Name" \
   BOOTSTRAP_CENTERS="Main Center" \
   npm run db:bootstrap
   ```

   This idempotently creates the Organization, the Center(s), and your
   ORG_ADMIN user — never run the dev seed (`db:seed`) against
   production; it wipes the database first.
6. **Smoke test**: sign in via Auth0 with that email → you should land
   on `/dashboard` (empty). Verify `/access-pending` catches an
   unknown email.

## Day 2 — Real data (Bloomerang import)

Run the three importers at `/import`, **in this order**:

1. **Constituents** → People (pick the center; idempotent on
   Constituent ID)
2. **Transactions** → Donations (idempotent on Transaction ID;
   auto-creates campaigns by name)
3. **Interactions** → Contact Log

For each: upload → confirm the auto-detected column mapping → **dry-run
preview** → commit. Then reconcile: pick 5–10 donors you know well and
compare lifetime totals and last-gift dates against Bloomerang. The
totals are computed from imported transactions, so discrepancies mean
missing/duplicate rows in the export — re-export and re-run (imports
are idempotent).

Tidy up in Settings → Campaigns: dedupe/rename any campaigns the
import auto-created, and confirm the alert thresholds match how the
team actually works.

## Day 3 — Staff accounts + verification

1. Settings → Users: add each staff member (their real sign-in email)
   with the right center role. They sign in via Auth0 the same way.
2. Walk one full loop as a staff member would: dashboard → follow-up
   queue → open a person → log a contact → record a donation → watch
   the alert color and KPIs update.
3. Send a test email from a person's profile (goes via Resend until
   Outlook is connected) and confirm the Contact row is logged.
4. Test the donor portal: `/portal/request` with a real donor email →
   magic link arrives via Resend → giving history displays.
5. Trigger both cron endpoints manually with
   `curl -H "Authorization: Bearer $CRON_SECRET" $APP_BASE_URL/api/cron/weekly-digest`
   (and `lapsed-donors`) and check the emails.

## Day 4 — Nice-to-haves (cut these first if time is short)

- **Custom domain**: point `crm.tcindiana.org` at Railway, update
  `APP_BASE_URL` and the Auth0 URLs.
- **Per-user Outlook send** (Phase 4.5): register an Azure app with
  redirect URI `${APP_BASE_URL}/api/auth/microsoft/callback`, set
  `MS_GRAPH_CLIENT_ID` / `MS_GRAPH_CLIENT_SECRET`, and have each staff
  member connect in Settings → Email integrations. Until then the
  shared Resend sender works fine.

## Day 5 — Cutover

- Staff use the app as the system of record; Bloomerang goes
  read-only (keep the subscription until the first month-end closes
  clean).
- Do a second Bloomerang export/import at end of week to catch
  anything entered in Bloomerang during the transition (imports are
  idempotent, so this is safe).
- Confirm Railway Postgres backups are enabled.

## Deferred (tracked, not this week)

- **Payment platform**: Stripe integration is built but on hold; when
  the platform decision lands, either set the `STRIPE_*` vars or plan
  an adapter for the chosen provider behind the existing
  checkout/webhook flow.
- Gmail OAuth (Phase 4.6) and inbound reply auto-logging (Phase 4.7).
