# RizonHire — Feature Inventory

_Last updated: May 12, 2026_

RizonHire is a **multi-tenant Applicant Tracking System (ATS)** with built-in video screening, public careers portals, and a super-admin platform layer. Data is strictly isolated per tenant via `company_id` row-level security.

---

## 1. Authentication & Access Control

- Email/password sign-in (Supabase Auth) — **invite-only**, no public registration
- Forgot password / reset password flows
- Role-based access control via `user_roles` table:
  - `super_admin` — platform operator (no `company_id`)
  - `admin` — full company access (delete jobs/candidates, manage tags)
  - `user` — standard company member
- Session-aware route guards (`ProtectedRoutes`, `AuthRoute`) with loading states to prevent flicker
- Multi-tenant isolation via `get_user_company_id()` and `has_role()` security-definer functions

## 2. Dashboard

- Per-company KPI overview: open jobs, total candidates, applications by stage
- Quick links into Jobs, Candidates, and Pipeline

## 3. Jobs Module

- Create / edit / close jobs (title, hiring manager, rich-text description, status)
- Open-job limit enforced per tenant (`companies.max_open_jobs`)
- Public visibility once `status = 'open'`

## 4. Candidates Module

- Candidate list with search and filters:
  - Job applied to
  - Education level
  - **Parish / state** (location)
  - Tags
- Candidate profile page:
  - Contact details (email, phone, **LinkedIn URL**, address, parish/state, country)
  - Resume history with versioning (`candidate_files`, signed R2 download URLs)
  - Activity timeline
  - Notes (per-user, company-scoped)
  - Interview feedback log
  - Tag assignments
- Candidates can **only** be added through the public application link (no in-app create)
- Admin-only delete

## 5. Hiring Pipeline (Kanban)

- Drag-and-drop application stages (`@hello-pangea/dnd`)
- Candidate side-panel with profile, resume preview, LinkedIn link, and quick actions
- Stage transitions persisted on `applications.stage`

## 6. Candidate Tags

- Company-scoped, color-coded labels
- Admin-managed library (`/admin/candidate-tags`)
- Assignable from candidate profile and pipeline

## 7. Public Careers Portal

- Slug-based routes: `/:companySlug/careers` and `/:companySlug/careers/:jobId`
- Legacy redirects from `/careers/:companySlug/...`
- Branded job listings (open jobs only) with detail pages and Apply CTA
- Slug lookup via `get_public_company_by_slug` RPC

## 8. Public Application Flow (`/apply/:jobId`)

- Anonymous candidate submission with:
  - Name, email, phone, address, parish/state, country, education level
  - Optional **LinkedIn profile URL** (validated client- and server-side via trigger)
  - Resume upload (private Cloudflare R2 via signed worker URL)
  - **Required Data Protection Agreement** checkbox linking to `/legal/data-protection`
- Creates `candidates` + `applications` rows under anonymous RLS policies

## 9. Video Screening Module

- Create one-question screening jobs synced to ATS jobs
- Public unique-link respondent flow (`/screen/:linkId`):
  - Privacy consent gate
  - Strict timer, single attempt, blind reveal
  - Direct-to-R2 video upload
- Reviewer dashboard: submissions, ratings, notes, status
- Auto-cleanup edge function (`screening-cleanup`) for expired data
- Screening analytics archive table

## 10. Interview Feedback

- Internal feedback (logged in by company users)
- **Guest feedback links** with token + 30-day expiry (`/feedback/:token`)
- Star rating + strengths / weaknesses / opportunities

## 11. Assessment Module

- Placeholder route (`/assessment`) reserved for future assessment workflow

## 12. Super Admin Console

- Restricted to `super_admin` role
- Overview: cross-tenant counts (companies, users, jobs)
- Companies: list, create new tenant + initial admin user (edge function `create-company-admin`), inline-edit `max_open_jobs`

## 13. Legal / Compliance

- Public Data Protection page (`/legal/data-protection`) covering data collection, lawful basis, retention, candidate rights

## 14. Infrastructure & Storage

- **Lovable Cloud** (managed Supabase) backend
- **Cloudflare R2** private buckets for resumes and screening videos via Cloudflare Worker (no public URLs)
- Realtime-capable schema for future live updates
- Edge functions (external Supabase project): `create-company-admin`, `screening-cleanup`,
  `get-invoice-download-url`, `request-invoice-pdf`, `send-invoice-email`,
  `billing-auto-renewal`, `billing-send-reminders`, `mark-invoice-paid`

## 16. Billing & Invoicing

- Per-company **billing profile** (`company_billing_profiles`) with legal name, billing email,
  contact, address, TRN, and auto-generated customer code
- Annual **subscription cycle** dates on `company_subscriptions`
  (`subscription_start_date`, `renewal_date`, `auto_renew`)
- **Invoices** with snapshotted bill-to fields, line items, status flow
  (`draft` → `sent` → `paid` / `overdue` / `void`), and PDF generation on R2
- **Invoice events** timeline (`invoice_events`) recording every action
- **Tenant billing page** (`/billing`): own-company invoices, signed PDF download,
  next renewal date, bank-deposit payment instructions
- **Super-admin billing tools** (`/admin/companies/:id` → Billing tab):
  - Generate invoice for next cycle (validates billing profile)
  - Issue / Mark paid (with payment method + reference) / Void
  - Send branded emails via Resend (`payment_due`, reminders, receipts)
- **Daily cron jobs**:
  - `billing-auto-renewal` — drafts invoices ~30 days before renewal
  - `billing-send-reminders` — pre-due (7d), due-today, overdue (every 7d, cap 4)
  - Both support `?dry_run=1` for safe inspection
- Paid invoices are immutable (`lock_paid_invoices` trigger) except for reminder metadata

## 15. Branding & UX

- DM Sans typography, teal/cyan modern SaaS aesthetic
- Responsive layout, collapsible sidebar, mobile drawer
- Dark sidebar / light content surfaces
- RizonHire logo and consistent semantic design tokens
