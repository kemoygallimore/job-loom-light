# Updated Billing & Tenant Management Plan

## Completed

| Stage | Name | Status |
|-------|------|--------|
| 1 | Foundations (suspension kill-switch) | Done |
| 2 | Master pricing (`plan_defaults`) | Done |
| 3 | Per-tenant subscription, overrides & discount | Done |
| 4 | Add-ons | Done |

---

## Plan-wide change: Annual-only billing

Billing is **annual only** — no monthly cycle anywhere in the system.

Required updates to already-shipped stages:

- **Stage 2** (`plan_defaults`): rename `monthly_price_cents` → `annual_price_cents` (DB column, AdminPricing form labels, save/load calls).
- **Stage 3** (`company_subscriptions`): drop `billing_cycle` column; rename `override_monthly_price_cents` → `override_annual_price_cents`. Remove cycle dropdown from AdminCompanyDetail.
- **Stage 4** (add-ons): unit prices represent the **annual** charge per unit.
- **Stage 6** (invoices, below): every invoice covers a 12-month period.

Migrations for the above run alongside Stage 5 to minimize churn.

---

## Remaining Stages

### Stage 5 — Non-core feature toggles

- `company_features` table: per-company booleans for Assessment Module, Public Careers Portal, Guest Feedback Links, Email Notifications, Custom Email Domain. Defaults pulled from `plan_defaults`.
- Helper `is_feature_enabled(_company_id, _feature text)`.
- Update RLS / RPCs:
  - `get_public_company_by_slug` returns nothing when Public Careers is off.
  - `feedback_links` SELECT policy gates on Guest Feedback being on.
- Frontend `useFeatureFlags()` hook; gating:
  - Assessment hidden in sidebar + `/assessment` 404s.
  - Public careers page shows "not available".
  - Guest feedback create UI hidden, public token URL returns "unavailable".
- Super-admin **Features** tab on `/admin/companies/:id` with toggle switches.

---

### Stage 6 — Invoicing (data + admin UI, no PDF yet)

- Tables:
  - `invoices` — `company_id`, `invoice_number` (sequential, e.g. `INV-2026-000123`), `status` (`draft|sent|paid|overdue|void`), `currency`, `subtotal_cents`, `discount_cents`, `total_cents`, `period_start`, `period_end` (always 12 months apart), `issued_at`, `due_at`, `paid_at`, `pdf_r2_key`, `pdf_generated_at`, `pdf_version`.
  - `invoice_line_items` — `invoice_id`, `description`, `quantity`, `unit_price_cents`, `amount_cents`, `source` (`base_plan|addon|adjustment`).
- New invoice prefills from subscription annual price + active add-ons + tenant discount.
- Super-admin pages:
  - `/admin/billing` — global list + filters.
  - `/admin/billing/invoices/:id` — detail with Issue, Mark paid, Mark overdue, Void.
- Tenant `/billing` page: plan summary, active add-ons, feature list, invoice history (download link wired in Stage 7).

---

### Stage 7 — PDF generation via Cloudflare Worker + R2 (new architecture)

PDF generation lives **outside Lovable**, on the existing Cloudflare Worker that already handles resumes/screening videos. Lovable only stores metadata and calls the Worker.

**Cloudflare side (user-managed, outside Lovable):**

- Private R2 bucket: `rizonhire-invoices`.
- Worker endpoints:
  - `POST /invoices/generate-pdf` — body: `{ invoice_id, company_id, invoice_number, payload }`. Worker renders PDF, writes to R2 at `invoices/{company_id}/{invoice_id}/invoice-{invoice_number}.pdf`, returns `{ pdf_r2_key, pdf_version }`.
  - `GET /invoices/:invoiceId/download` — returns short-lived signed R2 URL (or streams the file). Authenticated via the same shared-secret/JWT scheme as resume downloads.

**Lovable side:**

- Schema additions on `invoices` (already listed in Stage 6, restated for clarity):
  - `pdf_r2_key text`, `pdf_generated_at timestamptz`, `pdf_version integer default 0`.
- Edge function `request-invoice-pdf` (thin wrapper):
  - Verifies caller is super-admin (or tenant user owning the invoice for download).
  - Calls Worker `POST /invoices/generate-pdf` with the invoice payload.
  - On success, updates `invoices.pdf_r2_key`, `pdf_generated_at`, increments `pdf_version`.
- Edge function `get-invoice-download-url`:
  - Verifies caller has access to the invoice (super-admin OR `company_id = get_user_company_id(auth.uid())`).
  - Calls Worker `GET /invoices/:invoiceId/download`, returns the signed URL to the client.
- Frontend wiring:
  - Add `lib/invoiceUrl.ts` (mirrors `lib/fileUrl.ts` pattern) that calls `get-invoice-download-url` and returns the signed URL.
  - **Admin invoice detail** (`/admin/billing/invoices/:id`): `Generate PDF` (first time) / `Regenerate PDF` (bumps `pdf_version`) buttons calling `request-invoice-pdf`; `Download PDF` button using `invoiceUrl.ts`. Shows `pdf_generated_at` and version.
  - **Tenant billing page** (`/billing`): each invoice row gets a secure `Download PDF` button using the same `invoiceUrl.ts` helper. No regenerate button for tenants.
- Env: reuses existing `VITE_UPLOAD_BACKEND_URL` for Worker base URL; Worker shared secret stored as edge-function secret (`R2_WORKER_SECRET`) — added via the secret tool when Stage 7 starts.

**Sync guarantees:**

- PDF is never generated on Lovable; Lovable is the source of truth for invoice **data**, R2 is source of truth for the rendered **file**.
- Regenerating bumps `pdf_version` and overwrites the same R2 key (latest version is canonical); `pdf_generated_at` proves freshness.
- All downloads go through the edge function so RLS-equivalent access checks happen server-side before any signed URL is issued.

**Docs refresh** (`docs/01-features.md`, `docs/02-technical.md`):

- Add Billing module section.
- Add `rizonhire-invoices` bucket and Worker endpoints to Storage table.
- Add `request-invoice-pdf` and `get-invoice-download-url` edge functions to function list.
- Note the annual-only billing model.

---

## Dependency map

```text
Stage 1 ──┐
Stage 2 ──┼──► Stage 3 ──► Stage 4 ─┬──► Stage 5
                                    │
                                    └──► Stage 6 ──► Stage 7
```

Only Stages 5, 6, and 7 remain. The annual-only migration is bundled into Stage 5's SQL run so tenant pricing UI stays consistent before invoicing comes online.
