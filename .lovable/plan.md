# Billing & Invoicing — Staged Implementation Plan

Approved decisions:

- Email provider: **Resend** (API key stored as Supabase secret `RESEND_API_KEY` on the external project; sender domain to be confirmed).
- Status label: keep enum value `sent`, surface it as "Sent" (no relabel needed since you're OK with it).
- `auto_renew` defaults to **true** for all existing and new companies.
- New **`company_billing_profiles`** table (1:1 with `companies`) holds invoice identity; invoices snapshot it at issue time.

Each stage is independent, ships its own migration + UI, and leaves the app in a usable state. Run them in order.

---

## Stage A — Billing profile foundation

Goal: every company has a structured billing identity that invoices can snapshot from.

**Migration**

- Create `company_billing_profiles` (1:1 with `companies`):
  - `company_id uuid PK FK → companies(id) ON DELETE CASCADE`
  - `legal_name text`, `billing_email text NOT NULL`, `billing_contact_name text`, `billing_phone text`, `billing_address text`, `trn text`
  - `customer_code text UNIQUE` (auto via sequence + trigger, format `CUST-000123`, editable by super-admin)
  - `created_at`, `updated_at` + `update_updated_at_column` trigger
- RLS:
  - super-admin: full access
  - tenant company admin (`has_role(uid,'admin')` AND `company_id = get_user_company_id(uid)`): SELECT + UPDATE
- Backfill: insert one row per existing company, default `billing_email` from any existing `companies.email` or the first admin user's email; fallback to `''` and surface a warning badge in admin UI for rows that need attention.
- Drop the temporary `companies.email` / `companies.address` columns added in Stage 6 (after backfill).

**UI**

- `/admin/companies/:id` → new **Billing** tab. Top card: "Billing profile" — all fields inline editable by super-admin.
- "Create company" flow auto-creates the profile row with the new admin's email as `billing_email`.
- Validation helper `assertBillingProfileReady(companyId)` reused by Stage C invoice generation.

**Done when**: every company row has a profile; super-admin can edit it; tenant company admins can view/edit their own.

---

## Stage B — Subscription cycle dates

Goal: the system knows when each subscription started and when it renews.

**Migration**

- Add to `company_subscriptions`:
  - `subscription_start_date date NOT NULL DEFAULT current_date`
  - `renewal_date date` (computed via trigger as `start + 1 year`; editable by super-admin)
  - `auto_renew boolean NOT NULL DEFAULT true`
- Backfill: `subscription_start_date = companies.created_at::date`, `renewal_date = start + 1 year`, `auto_renew = true`.
- Trigger `set_renewal_date`: on insert or when `subscription_start_date` changes, recompute `renewal_date` if not explicitly set in the same UPDATE.

**UI**

- Billing tab on `/admin/companies/:id` adds a "Billing cycle" card under the profile card:
  - Start date, renewal date, days until renewal, auto-renew toggle.
  - "Edit dates" inline editor (super-admin only).
- Read-only summary visible to tenant company admins on their `/billing` page header.

**Done when**: cycle card shows correct dates for every company; toggling auto-renew persists.

---

## Stage C — Manual invoice generation (super-admin)

Goal: super-admin can create an invoice for a company's next cycle and walk it through the existing PDF / status flow.

**Migration**

- Add snapshot columns to `invoices` (populated at issue time, never updated after):
  - `bill_to_legal_name`, `bill_to_email`, `bill_to_contact_name`, `bill_to_phone`, `bill_to_address`, `bill_to_trn`, `bill_to_customer_code`
- Add `invoice_events` audit table (`id`, `invoice_id`, `actor_user_id`, `event text`, `at timestamptz default now()`, `meta jsonb`). RLS: super-admin full; tenant SELECT for own company.
- Add trigger `lock_paid_invoices`: blocks UPDATE on `invoices` once `status = 'paid'` except for `pdf_*` columns.

**UI / logic**

- Billing tab gains a **Generate invoice for next cycle** button (super-admin only). On click:
  - Validates billing profile (calls Stage A helper). Inline error if missing required fields.
  - Inserts `invoices` row with `status='draft'`, `period_start = renewal_date`, `period_end = renewal_date + 1 year`, `issued_at = null`, `due_at = renewal_date`, snapshots all `bill_to_*` fields.
  - Inserts `invoice_line_items` from current plan + active add-ons + active discount.
  - Logs `invoice_events.event = 'draft_created'`.
  - Navigates to `/admin/billing/invoices/:id`.
- Invoice history table on the Billing tab (number, period, status, total, issued, paid, link).
- Quick "Generate PDF" affordance in each invoice row when `pdf_r2_key IS NULL`.
- `AdminInvoiceDetail`: render `invoice_events` timeline; existing PDF / Issue / Mark Paid / Mark Overdue / Void buttons log events.

**Done when**: super-admin can click Generate → review draft → Generate PDF → Issue → Mark Paid, and the timeline reflects every step.

---

## Stage D — Tenant billing visibility

Goal: tenant company admins see only their company's invoices with download access.

- `/billing` lists own invoices (RLS already enforces). Status column shows "Sent" for `sent`.
- `Download PDF` per row when `pdf_r2_key` is set; otherwise muted "PDF not yet available."
- No Generate / Issue / Mark Paid / Void controls for non-super-admins (guarded by `useAuth().isSuperAdmin`).
- Header shows next renewal date + total + "Pay by bank deposit" instructions block (editable copy in Stage F email).

**Done when**: a tenant user only sees own-company invoices, can download issued PDFs, and never sees admin controls.

---

## Stage E — Resend integration (one-off send helper)

Goal: a single, reusable edge function on the external Supabase project for sending invoice emails via Resend. Used manually first; cron added in Stage F.

**Secrets** (manual setup in Supabase Dashboard, not in repo)

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (e.g. `billing@yourdomain.com` — must be a verified Resend domain)
- `APP_BASE_URL` (used to build links back to `/billing` in emails)

**Edge Function `send-invoice-email`** (external Supabase, `verify_jwt = true`)

- Body: `{ invoice_id: uuid, kind: 'payment_due' | 'reminder_7d' | 'due_today' | 'overdue_7d' | 'overdue_14d' | 'overdue_30d' }`
- Authz: super-admin only (called by UI button + cron).
- Loads invoice + snapshot fields + line items.
- Renders branded HTML (inline, no template engine needed — small helper per `kind`).
- POSTs to Resend `/emails`. Logs `invoice_events.event = 'email_sent'` with `meta = { kind, resend_id }`.

**UI**

- `AdminInvoiceDetail` adds **Send email** dropdown (super-admin only): pick a kind, send, confirm in timeline.

**Done when**: super-admin can manually send any of the 6 email kinds for a specific invoice and see the event in the timeline.

---

## Stage F — Auto-generate renewals + reminder cron

Goal: 30 days before renewal, an invoice is created, PDF rendered, and a payment-due email sent. Reminders and overdue notices fire on schedule.

**Migration**

- Postgres function `generate_renewal_invoices(_lead_days int default 30)` returns `setof uuid`:
  - For each `company_subscriptions` where `auto_renew = true` AND `renewal_date - _lead_days = current_date` AND no `draft|sent` invoice exists for that upcoming period:
    - Insert invoice (same shape as Stage C manual flow) with `status = 'sent'`, `issued_at = now()`.
    - Insert line items from plan + add-ons + discount.
    - Snapshot `bill_to_*` from `company_billing_profiles`.
    - Insert `invoice_events.event = 'auto_generated'`.

**Edge Function `auto-generate-renewal-invoices`** (external Supabase, `verify_jwt = false`, called by cron only via secret header check `X-Cron-Secret`)

- Step 1: call `generate_renewal_invoices(30)`; for each returned id, call existing `request-invoice-pdf` logic (extract shared helper or invoke function), then `send-invoice-email(id, 'payment_due')`.
- Step 2 (reminders, run same pass):
  - 7 days before `due_at` + status `sent` → `reminder_7d`
  - `due_at = today` + status `sent` → `due_today`
  - 7 / 14 / 30 days past `due_at` + status `sent` → `overdue_7d|14d|30d`; at 7d also flip status to `overdue` and log event.
- Idempotency: skip if an `invoice_events` row already exists for `(invoice_id, kind)` today.

**Cron** (insert-tool SQL, not migration — project-specific URL/keys)

```sql
select cron.schedule(
  'invoice-daily',
  '0 8 * * *',                              -- 08:00 UTC daily
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/auto-generate-renewal-invoices',
       headers := '{"Content-Type":"application/json","X-Cron-Secret":"<CRON_SECRET>"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
```

Enable `pg_cron` + `pg_net` extensions first.

**Done when**: setting a company's `renewal_date` to today + 30 and running the function manually creates an invoice, renders the PDF, and emails the billing contact. Subsequent days fire reminders without duplicates.

---

## Stage G — Polish & docs

- Update `docs/01-features.md` and `docs/02-technical.md`: billing profile, auto-renewal, Resend, cron, reminder cadence.
- Add a "Billing operations" runbook in `docs/`: how to mark paid after bank deposit confirmation, how to re-issue after void, how to disable auto-renew for a company.
- Add a test mode toggle on the cron edge function (`?dry_run=1`) that logs what it would do without writing or emailing.

---

## Open items requiring your input before Stage E

- Confirm the Resend sender domain (e.g. `billing@rizonhire.com`) and that it's verified in Resend.
- Confirm the `APP_BASE_URL` to embed in emails (`https://app.rizonhire.com`? the Lovable preview URL? custom domain?).

Once Stage A is approved, I'll start the migrations.
