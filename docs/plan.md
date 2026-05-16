# Billing flow — close the gaps

## What you have today

- `invoices` + `invoice_line_items` tables (Stage 6 migration) with statuses `draft | sent | paid | overdue | void`.
- `/admin/billing` global list and `/admin/billing/invoices/:id` detail page with Generate PDF / Download PDF / Issue / Mark paid / Mark overdue / Void buttons.
- Two external Supabase Edge Functions: `request-invoice-pdf` and `get-invoice-download-url`, calling the Cloudflare Worker (`api.rizonhire.com`) which renders the PDF into the private R2 bucket.
- Tenant `/billing` page that lists their own invoices and can download PDFs.
- `/admin/companies/:id` shows Subscription / Features / Add-ons tabs — **no billing tab and no way to create an invoice from the company page**.
- No `subscription_start_date` / `renewal_date` columns anywhere → no concept of "30 days before renewal".
- No auto-renewal job, no email reminders.

## Where your flow maps onto today's schema

| Your wording           | In the DB today                   |
| ---------------------- | --------------------------------- |
| Draft (not yet issued) | `status = 'draft'`                |
| Pending payment        | `status = 'sent'` (relabel in UI) |
| Paid                   | `status = 'paid'` + `paid_at`     |
| Overdue                | `status = 'overdue'`              |
| Cancelled              | `status = 'void'`                 |

No new status is needed — just rename "Sent" to "Pending payment" in the admin/tenant UI. This keeps the existing enum, RLS, and edge functions untouched.

## What's missing — and what this plan adds

### 1. Renewal dates on the subscription

Add to `company_subscriptions`:

- `subscription_start_date date`
- `renewal_date date` (computed as `start + 1 year` via trigger; editable so super-admin can shift)
- `auto_renew boolean default true`

Backfill: for existing companies, set `subscription_start_date = companies.created_at::date`, `renewal_date = start + 1 year`.

### 2. Billing tab on `/admin/companies/:id`

New tab "Billing" showing:

- Billing cycle card: start date, renewal date, days until renewal, auto-renew toggle, "Edit dates" inline editor.
- Plan summary line: current annual price, active add-ons, discount, computed total — same numbers that will land on the next invoice.
- **Generate invoice for next cycle** button (super-admin only). Prefills a draft invoice from subscription + active add-ons + discount and jumps to `/admin/billing/invoices/:id` where Generate PDF / Issue / Mark Paid already live.
- Invoice history table for this company (number, period, status badge, total, issued, paid, link to detail). Status badge for `sent` reads "Pending payment".

### 3. PDF visibility (why you "don't see it today")

The PDF buttons already exist, but only on `/admin/billing/invoices/:id`. Because no invoice has been created yet for any company, there's nothing to PDF. The new "Generate invoice" button on the company billing tab is the missing entry point. After clicking it once, the existing Generate/Download PDF UI takes over.

Also add a tiny "Generate PDF" affordance directly in the invoice history row when `pdf_r2_key IS NULL` so super-admins don't have to drill in.

### 4. Auto-generate renewals 30 days out + email reminder

New Postgres function on the external Supabase project:

```text
generate_renewal_invoices(_lead_days int default 30)
  → for every active subscription whose renewal_date - lead_days = today
    and that has no draft/sent invoice for the upcoming period:
      INSERT invoice (status='sent', period = next year, due_at = renewal_date)
      INSERT line items from plan + addons + discount
      RETURN list of (invoice_id, company_id)
```

New external Supabase Edge Function `auto-generate-renewal-invoices`:

1. Calls the SQL function above.
2. For each created invoice → calls Cloudflare Worker `/generate-pdf` (same shared-secret path the existing `request-invoice-pdf` uses) so the PDF is ready immediately.
3. For each created invoice → sends a "Payment due" email to the company's billing contact with the invoice number, amount, due date, and a download link that hits `get-invoice-download-url`.

Schedule it daily with `pg_cron` + `pg_net` on the external Supabase project (the snippet goes via the insert tool, not a migration, because the URL and anon key are project-specific).

### 5. Email reminder follow-ups (cheap win)

Same edge function, extra passes the same day it runs:

- 7 days before due → "Reminder: payment due in 7 days"
- 0 days (due today) → "Payment due today"
- 7 / 14 / 30 days overdue → "Overdue notice", and on day-7+ also flip status `sent → overdue`.

All driven off `invoices.due_at` and `status` — no extra tables needed.

## Improvements I'd recommend on top of your asks

1. **Don't add a `pending_payment` enum value.** Reusing `sent` keeps the existing edge functions, RLS, and admin UI working. Pure UI relabel.
2. **Always issue with `due_at = renewal_date`**, not `issued_at + 30`. That way the invoice's due date is literally the day service renews, which is also when the reminder cadence makes sense.
3. **Snapshot the line items at invoice creation.** `invoice_line_items` already copies description + price; never reach back to `company_subscriptions` to recompute later. Auditable + safe if pricing changes.
4. **Lock paid invoices.** Add a trigger that blocks `UPDATE` on `invoices` (other than `pdf_*` columns) once `status = 'paid'`. Stops accidental edits to historical records.
5. **Billing contact field on `companies`.** You already have `companies.email` from Stage 6. Use that as the reminder recipient; fall back to the company's admin user if null. Surface "Billing email" on the Billing tab so it's editable.
6. **Manual override stays first-class.** Even with auto-generation on, the "Generate invoice for next cycle" button stays — needed for off-cycle invoices, pro-rated upgrades, and re-issues after a void.
7. **Audit trail.** Tiny `invoice_events` table (`invoice_id`, `actor_user_id`, `event`, `at`, `meta jsonb`) logging issued / paid / voided / pdf_generated. Shows in a timeline on the invoice detail page — useful when a tenant disputes timing.

## Open questions before I build

1. **Email provider for reminders.** You said no Lovable Cloud, so this can't use the built-in transactional email infra. Which provider do you want the external edge function to call — Resend, Postmark, SendGrid, AWS SES, or the same Cloudflare-side path you use for PDFs? Whichever it is, I'll need the API key as a Supabase secret on the external project (`EMAIL_API_KEY`).
2. **Status label.** Confirm you're OK with "Sent → Pending payment" relabel rather than adding a new enum value.
3. **Auto-renew default.** Should existing companies default to `auto_renew = true` (auto invoices start flowing next cycle) or `false` (you manually opt in per company)?

## Implementation order (once you approve)

1. Migration: `subscription_start_date`, `renewal_date`, `auto_renew` on `company_subscriptions`; backfill; trigger; `invoice_events` table; locked-paid trigger.
2. `AdminCompanyDetail` → new **Billing** tab (cycle card, plan summary, Generate invoice button, invoice history).
3. UI relabel `sent → Pending payment` everywhere (admin list, admin detail, tenant `/billing`).
4. New external Supabase Edge Function `auto-generate-renewal-invoices` (code provided for manual paste into Dashboard editor).
5. SQL snippet to schedule it daily via `pg_cron` + `pg_net` (run once via insert tool, not migration).
6. Email template + send helper inside the same edge function, using the provider you pick in Q1.
7. Documentation refresh (`docs/plan.md`, `docs/01-features.md`).

No Lovable Cloud is touched at any step. All edge functions and cron live on your external Supabase project.

# Stage 7 — Invoice PDF via External Supabase + Cloudflare Worker

Wires the existing Cloudflare Worker (`https://api.rizonhire.com`) into the app through two new Supabase Edge Functions deployed to the **external** Supabase project (not Lovable Cloud). The frontend never talks to the Worker or R2 directly.

## Architecture

```text
Browser ──(JWT)──► Supabase Edge Function ──(Bearer R2_WORKER_SECRET)──► Cloudflare Worker ──► R2
```

- `request-invoice-pdf` — super-admin only; generates/regenerates the PDF and persists `pdf_r2_key`, `pdf_generated_at`, `pdf_version` on the invoice.
- `get-invoice-download-url` — super-admin OR tenant user owning the invoice; returns a short-lived signed URL.

## Database

Stage 6 (`invoices`, `invoice_line_items`) has not been migrated yet on the external Supabase. Ship a single SQL file that:

1. Creates `invoices` with all Stage 6 columns plus `pdf_r2_key text`, `pdf_generated_at timestamptz`, `pdf_version integer default 0`.
2. Creates `invoice_line_items` (`invoice_id`, `description`, `quantity`, `unit_price_cents`, `amount_cents`, `source`).
3. Adds `email text` and `address text` to `companies` (needed by the PDF payload; currently absent).
4. Enables RLS:
   - Super-admins: full access on both tables.
   - Tenant users: SELECT only where `company_id = get_user_company_id(auth.uid())`.
5. Adds `invoice_number` sequence + trigger (`INV-YYYY-NNNNNN`).

File: `supabase/migrations/<timestamp>_invoices.sql` — applied via `supabase db push` against the external project.

## Edge Functions

Both live under `supabase/functions/` and deploy with the Supabase CLI to the external project.

### `supabase/functions/_shared/cors.ts`

Shared CORS headers: `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`; methods `POST, OPTIONS`.

### `supabase/functions/request-invoice-pdf/index.ts`

- OPTIONS → CORS preflight.
- Reads `Authorization` header; creates a user-scoped client with `SUPABASE_URL` + `SUPABASE_ANON_KEY` and `global.headers.Authorization` to resolve `auth.getUser()`. 401 if missing.
- Calls existing `has_role(user.id, 'super_admin')` RPC. 403 if false.
- Validates body `{ invoice_id: uuid }`. 400 if missing.
- Switches to service-role client (`SUPABASE_SERVICE_ROLE_KEY`) for reads/writes:
  - SELECT invoice; 404 if not found.
  - SELECT line items.
  - SELECT company (name, email, address).
- Builds the exact payload specified in the request, POSTs to `${R2_WORKER_BASE_URL}/invoices/generate-pdf` with `Authorization: Bearer ${R2_WORKER_SECRET}`.
- On Worker success: UPDATE invoice with `pdf_r2_key`, `pdf_version`, `pdf_generated_at = now()`. Returns the updated row.
- Logs errors server-side; never echoes the secret.

### `supabase/functions/get-invoice-download-url/index.ts`

- OPTIONS → CORS preflight.
- Auth check identical to above. 401 if missing.
- Validates `{ invoice_id }`. 400 if missing.
- Service-role SELECT of invoice. 404 if not found.
- Access check:
  - `has_role(user.id, 'super_admin')` → allow, OR
  - `invoice.company_id == get_user_company_id(user.id)` → allow,
  - else 403.
- If `pdf_r2_key` is null → 400 `"PDF has not been generated yet."`.
- GET `${R2_WORKER_BASE_URL}/invoices/${invoice_id}/download?key=${encodeURIComponent(pdf_r2_key)}` with `Authorization: Bearer ${R2_WORKER_SECRET}`.
- Returns `{ url, expires_in }` to the client.

### Secrets (set via CLI, never in repo)

- `R2_WORKER_BASE_URL` = `https://api.rizonhire.com`
- `R2_WORKER_SECRET` = user-provided
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are auto-provided by Supabase to Edge Functions.

### `supabase/config.toml`

Add per-function blocks for both functions with `verify_jwt = true` so Supabase enforces the JWT before our code runs.

## Frontend

### `src/lib/invoiceUrl.ts`

```ts
export async function getInvoiceDownloadUrl(invoiceId: string): Promise<string>
```

Wraps `supabase.functions.invoke("get-invoice-download-url", { body: { invoice_id } })`. Throws on error. Returns `data.url`.

### `src/lib/requestInvoicePdf.ts`

`requestInvoicePdf(invoiceId)` → invokes `request-invoice-pdf`, returns the updated invoice row for cache refresh.

### Admin invoice detail — `/admin/billing/invoices/:id`

(Stage 6 page; built alongside this stage.)

- Header chips for `pdf_generated_at` and `pdf_version`.
- Buttons (super-admin only):
  - `Generate PDF` when `pdf_r2_key` is null.
  - `Regenerate PDF` when `pdf_r2_key` exists.
  - `Download PDF` when `pdf_r2_key` exists; calls `getInvoiceDownloadUrl` and opens the URL in a new tab.
- Toasts on success/failure; React Query invalidation after generate.

### Tenant billing — `/billing`

- Invoice history row: `Download PDF` button when `pdf_r2_key` is set, otherwise muted `PDF not yet available.` label.
- No Generate / Regenerate / Mark paid / Overdue / Void controls rendered for non-super-admins (guarded by `useAuth().isSuperAdmin`).

## CLI deployment commands (for the user)

```bash
# MY_PROJECT_REF = Supabase Dashboard → Project Settings → General → "Reference ID"
supabase login
supabase link --project-ref MY_PROJECT_REF

# Apply the migration to the external DB
supabase db push

# Set Edge Function secrets (one-time)
supabase secrets set R2_WORKER_BASE_URL=https://api.rizonhire.com
supabase secrets set R2_WORKER_SECRET=MY_REAL_SECRET

# Deploy the two functions
supabase functions deploy request-invoice-pdf
supabase functions deploy get-invoice-download-url
```

## Testing checklist

Admin:

1. Open `/admin/billing/invoices/:id` for an invoice with no PDF → see `Generate PDF`.
2. Click → row updates: `pdf_r2_key`, `pdf_generated_at`, `pdf_version=1`. Buttons swap to `Regenerate PDF` + `Download PDF`.
3. Click `Regenerate PDF` → `pdf_version` increments, `pdf_generated_at` refreshed.
4. Click `Download PDF` → new tab loads the signed R2 URL; PDF renders.

Tenant:

1. Sign in as tenant user. `/billing` shows only own-company invoices.
2. Rows with `pdf_r2_key` show `Download PDF`; others show `PDF not yet available.`
3. No Generate / Regenerate / Mark paid / Overdue / Void controls visible.
4. Direct invoke of `get-invoice-download-url` with another company's `invoice_id` → 403.

Security:

1. Searching the frontend for `R2_WORKER_SECRET` or `api.rizonhire.com` returns no hits in invoice code (existing `getSignedVideoViewUrl` / `videoUrl.ts` for resumes/videos stay unchanged).
2. Network tab shows only `*.supabase.co/functions/v1/...` calls from the browser; no direct calls to `api.rizonhire.com` for invoices.
3. Existing resume/video Worker flow untouched.

## Files

New:

- `supabase/migrations/<ts>_invoices.sql`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/request-invoice-pdf/index.ts`
- `supabase/functions/get-invoice-download-url/index.ts`
- `src/lib/invoiceUrl.ts`
- `src/lib/requestInvoicePdf.ts`

Edited:

- `supabase/config.toml` — add function blocks
- `src/pages/admin/AdminInvoiceDetail.tsx` (Stage 6 page) — add buttons + PDF metadata
- `src/pages/Billing.tsx` (Stage 6 tenant page) — add download / empty state
- `docs/02-technical.md`, `docs/01-features.md`, `docs/plan.md` — mark Stage 7 done; document new functions and `rizonhire-invoices` bucket

Unchanged: Cloudflare Worker, existing `silverweb-ats-resumes` / `silverweb-ats-videos` flows.
