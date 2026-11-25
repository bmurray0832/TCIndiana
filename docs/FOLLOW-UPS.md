# Follow-ups after the MVP launch

The MVP is live as a proof of concept. These items were deliberately
left for after launch. Each says what it is, why it was held, and what
turns it on.

## Held on purpose

### Scheduled emails and the nightly sync (off)

The in-app scheduler is switched off in production with
`SCHEDULER_DISABLED=1` on the TCIndiana service in Railway. While it is
set, none of these run on their own:

| Job | When (Indiana time) | What it does |
|---|---|---|
| Weekly digest | Monday 9:00 AM | Emails each active user their follow-up list |
| Lapsed donors | 1st of the month, 10:00 AM | Emails HQ admins the re-engagement list |
| Bloomerang sync | Every night, 2:00 AM | Pulls changes from Bloomerang (needs the API key) |

**To turn it on:** remove `SCHEDULER_DISABLED` (or set it to `0`) on the
service and redeploy. Do this once staff are onboarded and expecting the
emails, and confirm `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` are set
first. The switch is all-or-nothing: it enables all three jobs.

Any job can still be run by hand while the scheduler is off:
`curl -H "Authorization: Bearer $CRON_SECRET" $APP_BASE_URL/api/cron/weekly-digest`
(also `/lapsed-donors` and `/bloomerang-sync`).

### Bloomerang direct sync (waiting on the API key)

- A Bloomerang administrator creates a private API key under User
  Settings. Set it as `BLOOMERANG_API_KEY` on the Railway service. It
  grants full access to the Bloomerang database: never commit it.
- Then Settings → Integrations: pick the default center, enter the label
  of the Bloomerang custom field that names a center (if there is one),
  and run a full sync.
- Open question for TC Indiana: how are centers told apart in Bloomerang?
  The mapping assumes a constituent custom field. If it is a fund or
  something else, the mapping source needs a small change.
- Until then, the CSV import (Bloomerang import in the sidebar) loads
  real data.

### Online giving (built, not yet proven against Stripe)

The payment handling was tested against a stand-in for Stripe, not
Stripe itself. Before taking a real gift:

1. Add these events to the Stripe webhook endpoint:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`,
   `charge.refunded`, `charge.updated`.
2. In Stripe test mode, run one card gift, one bank (ACH) gift, one
   monthly gift and one refund, and check each lands correctly.
3. Confirm `PORTAL_SECRET` or `AUTH0_SECRET` is set (the donor portal
   refuses to run in production without one).

## For TC Indiana to decide or give feedback on

### Year-end giving statements

- **Wording.** The statement text is generic. Whoever handles finances
  should approve it before statements go to donors.
- **Tax ID.** Printed only when `ORG_TAX_ID` is set on the service. A
  statement used for tax purposes should carry it.
- **Mailing addresses.** The app does not store donor addresses, so
  statements can be handed out or sent as a PDF but not mailed in
  windowed envelopes.
- **Delivery.** Statements are print-only; there is no "email to donor".

### Staff sign-in

Sign-in requires a verified email in Auth0, and an account stays tied to
the first identity that signed in with it. A staff member who is refused
needs to verify their email, or have an admin re-link the account.

### Roles

Viewer is read-only; Staff can add, edit and import; Director can also
edit their center's settings; HQ admins can do everything. Feedback
wanted on whether Staff should be able to bulk-import.

## Later, if Bloomerang is to be fully replaced

In rough order:

1. Mailing addresses, households, soft credits, pledges and in-kind gifts
   (data model and sync).
2. Per-gift receipts and acknowledgement letters.
3. Moving recurring donors off Bloomerang's payment processor. Their
   cards are stored there, so either the processor transfers them or each
   donor signs up again.
4. Mass email, by connecting a mail tool rather than building one.
5. Reconcile totals against Bloomerang, freeze it, take a final export,
   then end the subscription. Avoid cutting over in December, and check
   the Bloomerang renewal date for the real deadline.

## Housekeeping

- Custom domain: the app is on `tcindiana-production.up.railway.app`.
- `README.md` still has stale "Phase 0" wording in places.
- Gift dates and month boundaries use UTC; a gift entered late in the
  evening Indiana time can land on the next day.
- Year-to-date totals cached on each person are only refreshed when that
  person has new activity, so they go stale on January 1.
- Not ported from Holy Insights: per-user page toggles.
- Remaining dependency advisories need a major Prisma upgrade.
