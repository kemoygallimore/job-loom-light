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

## Storage Buckets

| Bucket | Visibility | Contents |
|---|---|---|
| `resumes` | Private | Candidate CVs |
| `screening-videos` | Private | Video screening submissions |

All access is mediated through the Cloudflare Worker; the app fetches short-lived signed URLs (`getSignedVideoViewUrl`, `fileUrl`).

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
