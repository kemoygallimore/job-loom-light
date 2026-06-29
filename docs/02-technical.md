# RizonHire — Technical Documentation

_Last updated: May 12, 2026_

## Stack

- **Frontend:** React 18 + Vite 5 + TypeScript 5
- **UI:** Tailwind CSS v3, shadcn/ui, Radix primitives, lucide-react icons
- **State / data:** TanStack Query, React Router v6
- **Drag & drop:** `@hello-pangea/dnd`
- **Charts:** Recharts
- **Backend:** Supabase (Postgres + Auth + Edge Functions) — provisioned via Lovable Cloud, but the app uses an **external** Supabase project. The `@/integrations/supabase/client` import is aliased in `vite.config.ts` to `src/integrations/supabase/externalClient.ts`.
- **Object storage:** Private Cloudflare R2 buckets fronted by a Cloudflare Worker. The frontend never holds R2 credentials; it requests signed URLs at upload/download time. Env: `VITE_UPLOAD_BACKEND_URL`.

## Repository Layout

```
src/
  App.tsx                 Router + providers
  components/
    AppLayout.tsx         Authenticated app shell (sidebar/header)
    candidate/            Candidate profile widgets (filters, notes, files, tags, timeline)
    pipeline/             Kanban card + side panel
    ui/                   shadcn primitives
  hooks/
    useAuth.tsx           Auth + profile + role context
  integrations/supabase/  Generated client + types (DO NOT EDIT)
  lib/                    Upload helpers, signed URL helpers, formatters
  pages/
    Auth, Dashboard, Jobs, Candidates, CandidateProfile, Pipeline, Assessment
    admin/                Super-admin pages
    apply/                Public application form
    careers/              Public careers portal
    feedback/             Public guest feedback page
    legal/                Data protection page
    screening/            Internal + public video screening
supabase/
  config.toml             Project + per-function settings
  functions/
    create-company-admin/ Provisions auth user + profile + role for a new tenant
    screening-cleanup/    Removes expired screening artifacts
```

## Routing Map

| Path | Auth | Component |
|---|---|---|
| `/` | — | Redirect to `/auth` |
| `/auth`, `/forgot-password`, `/reset-password` | Public | Auth pages |
| `/:companySlug/careers` | Public | Careers landing |
| `/:companySlug/careers/:jobId` | Public | Job detail |
| `/careers/:companySlug[/:jobId]` | Public | Legacy → redirect |
| `/apply/:jobId` | Public | Application form |
| `/screen/:linkId` | Public | Video screening |
| `/feedback/:token` | Public | Guest interview feedback |
| `/legal/data-protection` | Public | DPA policy |
| `/dashboard`, `/jobs`, `/candidates[/:id]`, `/pipeline` | Auth | ATS |
| `/admin/candidate-tags` | Auth (admin) | Tag library |
| `/screening`, `/screening/:jobId/submissions` | Auth | Video screening console |
| `/assessment` | Auth | Reserved |
| `/admin`, `/admin/companies` | Super admin | Platform console |

## Database Schema (public)

| Table | Purpose |
|---|---|
| `companies` | Tenants. Auto-generates `slug` from `name` via trigger. `max_open_jobs` enforces job-count limit. |
| `profiles` | User profile linked to `auth.users.id`; carries `company_id`. |
| `user_roles` | RBAC (`super_admin`, `admin`, `user`). Always queried via `has_role()`. |
| `jobs` | Postings; `status enum job_status`. Public can SELECT only `status='open'`. |
| `candidates` | Candidate master record (per company). Includes `linkedin_url` (validated by trigger). |
| `candidate_files` | Versioned resume + document history (R2 bucket + key). |
| `candidate_tags`, `candidate_tag_assignments` | Color-coded labels per company. |
| `applications` | Pipeline rows: candidate × job × stage. |
| `notes` | Per-user candidate notes. |
| `interview_feedback` | Internal + guest feedback. |
| `feedback_links` | Tokenized 30-day guest feedback links. |
| `screening_jobs`, `screening_submissions`, `screening_analytics` | Video screening. |

### Key SECURITY DEFINER functions

- `has_role(uuid, app_role)` — RBAC check.
- `get_user_company_id(uuid)` — tenant lookup, used in every RLS policy.
- `get_public_company_by_slug(text)` / `get_public_company_for_job(uuid)` — anonymous lookups limited to companies with at least one open job.
- `archive_resume_version(...)` — atomic insert into `candidate_files`.
- `generate_company_slug()` — slug trigger on `companies`.
- `validate_candidate_linkedin_url()` — trigger; rejects non-LinkedIn URLs and >500 chars.
- `update_updated_at_column()` — generic timestamp trigger.

### Row-Level Security model

- All tenant tables gate authenticated reads/writes on `company_id = get_user_company_id(auth.uid())`.
- `admin` role required for destructive operations.
- `super_admin` has cross-tenant SELECT on companies, profiles, user_roles, screening artifacts.
- Anonymous (`anon`) policies are narrowly scoped:
  - INSERT into `candidates` / `applications` / `candidate_files (category=resume)` only when a matching open job exists.
  - INSERT into `screening_submissions` only with `privacy_consent=true` and a non-expired `screening_job`.
  - SELECT `feedback_links` while `expires_at > now()`.

## Cloudflare R2 Buckets

| Bucket | Visibility | Contents |
|---|---|---|
| `silverweb-ats-resumes` | Private | Candidate CVs and supporting documents |
| `silverweb-ats-videos` | Private | Video screening submissions |

All file access is mediated through the Cloudflare Worker at `https://api.rizonhire.com`; the app stores only R2 bucket names and object keys in Supabase tables.
Legacy Supabase Storage buckets (`resumes`, `screening-videos`) should remain private and policy-free until they are confirmed empty, then deleted with `scripts/delete-supabase-storage-buckets.mjs`.

## Edge Functions

- **`create-company-admin`** — invoked by super admin on new-tenant creation. Creates the auth user, inserts a `profiles` row with the new `company_id`, and assigns the `admin` role. Uses the service role key.
- **`screening-cleanup`** — scheduled job that purges expired screening submissions and archives analytics.

## Auth Flow

1. User submits credentials on `/auth`.
2. `useAuth` hook subscribes to `supabase.auth` state and loads `profiles` + `user_roles`.
3. `ProtectedRoutes` waits for both before rendering `AppLayout`.
4. Super admins (no `company_id`) are redirected to `/admin`.

## Multi-Tenancy

- Every business table carries `company_id`.
- Client queries always filter implicitly via RLS.
- Public/anonymous reads use SECURITY DEFINER RPCs (`get_public_company_*`) so RLS doesn't have to expose the entire table.

## Validation

- Client-side: regex on LinkedIn URLs, required-field checks, file-size limits.
- Server-side: triggers (LinkedIn URL), RLS WITH CHECK clauses, edge-function input validation.

## Environment Variables (Vite)

| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | External Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key |
| `VITE_SUPABASE_PROJECT_ID` | Project ref |
| `VITE_UPLOAD_BACKEND_URL` | Cloudflare Worker base URL for signed uploads/downloads |

## Local Development

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest
npx playwright test
```

## Deployment

- Frontend: Vercel (`vercel.json`).
- Backend: managed Supabase, edge functions auto-deploy on push.

## Known Constraints

- Default Supabase query limit is 1,000 rows — paginate dashboards beyond that scale.
- `src/integrations/supabase/client.ts` and `types.ts` are auto-generated; the project aliases `client` to `externalClient.ts`.
- Roles must NEVER be moved onto `profiles` — keep them in `user_roles` to avoid privilege escalation.

## Billing Subsystem

### Tables

- `company_billing_profiles` (1:1 with `companies`) — invoice identity snapshot source
- `company_subscriptions` — plan, add-ons, discount, `subscription_start_date`,
  `renewal_date`, `auto_renew`
- `company_addons` — active add-on quantities
- `plan_defaults` — single-row default plan price/currency
- `invoices` — status enum (`draft|sent|paid|overdue|void`), snapshotted `bill_to_*`
  fields, `pdf_r2_key`, `payment_method`, `payment_reference`, `reminders_sent` (jsonb)
- `invoice_line_items` — per-invoice charges (plan, addon, discount)
- `invoice_events` — append-only audit timeline

### Triggers

- `set_renewal_date` — recomputes `renewal_date = start + 1 year` when start changes
- `lock_paid_invoices` — blocks updates to paid invoices except `pdf_*` and `reminders_sent`
- `generate_customer_code` — auto-assigns `CUST-000123` style codes

### Edge functions (external Supabase project)

| Function | Auth | Purpose |
|---|---|---|
| `send-candidate-email` | JWT; constrained public mode or super-admin test mode | Sends application confirmation and template test emails via Resend |
| `screening-cleanup` | `x-cron-secret` | Archives old screening analytics and deletes expired screening jobs |
| `get-invoice-download-url` | JWT | Returns short-lived signed R2 URL for the invoice PDF |
| `request-invoice-pdf` | super-admin JWT | Renders/regenerates PDF on R2, updates invoice |
| `send-invoice-email` | super-admin JWT or `x-cron-secret` | Sends payment-due email via Resend |
| `mark-invoice-paid` | super-admin JWT | Sets paid, advances `renewal_date`, sends receipt |
| `billing-auto-renewal` | super-admin JWT or `x-cron-secret` | Drafts invoices in renewal window |
| `billing-send-reminders` | super-admin JWT or `x-cron-secret` | Sends pre-due/due/overdue emails |

The billing cron functions accept `{ "dry_run": true }` to inspect what they would do.

### Required secrets (external project)

`RESEND_API_KEY`, `RESEND_FROM`, `RIZONHIRE_FROM_EMAIL`, `ALLOWED_ORIGINS`, `CRON_SECRET`, `R2_WORKER_BASE_URL`, `R2_WORKER_SECRET`.

`ALLOWED_ORIGINS` should include only the production app origin plus local development origins, for example:
`https://app.rizonhire.com,http://localhost:8080,http://127.0.0.1:8080`.

`screening-cleanup` uses `R2_WORKER_BASE_URL` and `R2_WORKER_SECRET` to delete old video objects from Cloudflare R2 before deleting their database rows.

### Daily schedule (pg_cron, run in external SQL editor)

```sql
select cron.schedule('billing-auto-renewal-daily', '0 8 * * *', $$
  select net.http_post(
    url := 'https://jfiyvvigvknfemqfnucl.supabase.co/functions/v1/billing-auto-renewal',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body := '{"window_days":30,"auto_issue":true,"auto_email":true}'::jsonb
  );
$$);

select cron.schedule('billing-reminders-daily', '15 8 * * *', $$
  select net.http_post(
    url := 'https://jfiyvvigvknfemqfnucl.supabase.co/functions/v1/billing-send-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body := '{}'::jsonb
  );
$$);
```
