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
