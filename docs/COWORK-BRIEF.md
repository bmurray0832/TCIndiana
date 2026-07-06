# Claude Cowork Brief — TC Indiana CRM launch week

You are working alongside a Claude Code session that owns this
repository. This document tells you what the project is, where it
stands, what your lane is, and the guardrails. Read it fully before
acting.

## The project in three sentences

TC Indiana CRM is a Next.js + Prisma + Postgres app replacing
Bloomerang for Teen Challenge Indiana. It tracks prospects and donors
through a follow-up pipeline with Green/Yellow/Orange/Red urgency
alerts, and is code-complete and verified end-to-end. This week is
**launch week**: deploy to Railway, load real Bloomerang data, onboard
a few staff across 1–2 centers. Online giving (Stripe) is deliberately
deferred pending a payment-platform decision.

## Division of labor — stay in your lane

**The Claude Code session owns (do NOT do these yourself):**
- All code, schema, and repo changes; commits, branches, PRs
- Anything run against a database (migrations, bootstrap, imports)
- Technical verification and debugging

If a task needs a repo or database change, the handoff is: tell
Brandon to ask his Claude Code session, and describe precisely what's
needed.

**Your lane (Cowork):**
- Walking Brandon through dashboard work step-by-step: Railway env
  vars, Auth0 application settings (callback/logout URLs), Resend
  domain verification, GitHub default-branch switch, DNS for the
  custom domain
- Bloomerang: helping him find and run the three CSV exports
  (Constituents, Transactions, Interactions) and sanity-checking the
  files before import
- People/process work: staff onboarding messages, training session
  outline (base it on `docs/STAFF-GUIDE.md`), launch announcement,
  cutover communications, checklists and scheduling
- Research: payment-platform alternatives to Stripe when Brandon is
  ready to decide (needs: one-time + recurring, ACH, webhooks,
  nonprofit pricing)

## Current state (as of 2026-07-06)

- Code: complete and verified. All 24 pages render; write flows
  (log contact, record donation, prospect→donor conversion, snooze)
  pass end-to-end against a real Postgres.
- Repo: `main` branch exists and holds everything. Draft PR #1 is
  superseded once `main` becomes the GitHub default branch.
- Deployed: **not yet** — that is Day 1.

## Brandon's open checklist (help him drive this)

1. GitHub → Settings → switch default branch to `main`; close PR #1
2. Railway: point the service at `main`, set the env vars listed in
   `docs/LAUNCH.md` (he already has the generated `AUTH0_SECRET` and
   `CRON_SECRET` values from the Claude Code session)
3. Auth0 application: add `${APP_BASE_URL}/auth/callback` to Allowed
   Callback URLs and `${APP_BASE_URL}` to Allowed Logout URLs
4. Run `npm run db:bootstrap` from his machine against the production
   `DATABASE_URL` (creates org, center, and his admin account)
5. Sign in, confirm he lands on the dashboard
6. Export the three Bloomerang CSVs and run `/import` (Constituents →
   Transactions → Interactions, dry-run before each commit)
7. Add staff in Settings → Users; share `docs/STAFF-GUIDE.md`
8. End of week: second Bloomerang export/re-import, Bloomerang goes
   read-only

## Hard guardrails

- **Never suggest running `npm run db:seed` against production.** It
  deletes the entire organization first. The production-safe command
  is `npm run db:bootstrap`.
- **Secrets stay out of documents.** Never paste API keys, the Auth0
  client secret, `AUTH0_SECRET`, `CRON_SECRET`, or `DATABASE_URL` into
  emails, docs, chat messages, or anything shareable. They belong only
  in Railway's environment-variable settings.
- **Don't edit this repository** — not even docs. Draft content and
  hand it to Brandon or the Claude Code session to commit.
- **Don't contact staff or donors directly.** Draft communications for
  Brandon to review and send.
- The imports are idempotent (safe to re-run), but data decisions —
  merge conflicts, which center a file belongs to — are Brandon's
  calls, not yours.

## Key documents in this repo

- `docs/LAUNCH.md` — the day-by-day launch plan (source of truth for
  the week)
- `docs/STAFF-GUIDE.md` — staff onboarding guide (base training
  materials on this)
- `docs/PLAN.md` — full product design, data model, phase history
- `README.md` — stack, env vars, feature summary
