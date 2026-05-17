# Build Plan: Admin Management, Account Menu & Email Templates

A staged rollout for super-admin company/user management, an "Account" menu consolidation, a data-protection editor, and a Resend-powered candidate email system with editable templates.

## Stage 1 — Editable Companies & Super-Admin User Management

**Scope**
- Add "Edit company" on `AdminCompanyDetail` (name + slug regenerate optional, max_open_jobs, status).
- New "Users" tab on `AdminCompanyDetail` listing all profiles for that company with role badges.
- Super-admin actions: invite/create user into a company (calls existing `create-company-admin` style edge function, extended to accept role and target company), edit name/role, deactivate/remove.
- Server-side seat enforcement: block adding a user beyond company's `seat_count` (from billing profile).

**End result:** Super admin can rename companies and fully manage who has access to each tenant, respecting seat limits.

**Risks / bottlenecks**
- Deleting an `auth.users` row cascades — prefer "deactivate" (revoke role + flag) over hard delete.
- Slug changes break existing public careers URLs — keep slug immutable by default, offer "regenerate" with explicit warning.
- Seat count source of truth needs to be locked down (billing profile vs. companies table).

---

## Stage 2 — Tenant-Side User Management

**Scope**
- New "Team" page inside tenant module (admin-role only) at `/team`.
- List company users, invite new ones (up to seat limit), change role between `admin` / `recruiter`, deactivate.
- Reuse the edge function from Stage 1, scoped by `company_id = get_user_company_id(auth.uid())`.

**End result:** Company admins self-serve seat management without contacting support.

**Risks**
- Privilege escalation: must verify on server that caller is `admin` of the same company before insert into `user_roles`.
- Email invites depend on Stage 5 infra — until then, fall back to "set password" link generated server-side.

---

## Stage 3 — Account Menu Consolidation

**Scope**
- Remove "Billing" from the main sidebar nav for tenants.
- Replace bottom user block in `AppLayout` with a popover/dropdown ("Account") containing: Profile, Team (Stage 2), Billing, Data Protection settings (tenant view), Sign out.
- Super-admin sidebar unchanged.

**End result:** Cleaner nav focused on hiring workflow; all account/admin items live under the user chip.

**Risks**
- Discoverability of Billing drops — add a one-time tooltip/banner after deploy.
- Mobile UX: dropdown must work inside the collapsible sheet.

---

## Stage 4 — Data Protection Policy Editor (Super-Admin)

**Scope**
- New table `company_policies` (company_id, data_protection_html, updated_at, updated_by).
- Super-admin section `/admin/companies/:id/policies` with rich-text editor (reuse `RichTextEditor`).
- Public `/legal/data-protection` and tenant Account menu pull from this table instead of the static page.
- Default content seeded from current static `DataProtection.tsx`.

**End result:** Each company has its own editable data-protection policy, served on public careers pages.

**Risks**
- HTML stored from rich-text editor must be sanitized on render (DOMPurify) to prevent stored XSS.
- Versioning/audit — recommend a `company_policy_versions` history table for compliance.

---

## Stage 5 — Resend Integration & Candidate Application Email

**Scope**
- Add Resend connector + `RESEND_API_KEY` secret.
- New edge function `send-candidate-email` (deployed to external Supabase) that:
  - Loads template by key, renders with `{{candidate_name}}`, `{{company_name}}`, `{{job_title}}` placeholders.
  - Sends via Resend from `no-reply@rizonhire.com` (reply-to = company hiring email).
- Hook into `PublicJobApplication` submit to fire `application_received` template.
- Log every send to `email_send_log` table (template_key, to, status, application_id, provider_message_id).

**End result:** Every applicant immediately gets a branded thank-you email referencing the company & role they applied for.

**Risks**
- Rizonhire domain must be verified on Resend (SPF/DKIM) — block stage until DNS confirmed.
- Failed sends shouldn't break the application flow — fire-and-forget with retries via send log.
- Rate limits during job-fair spikes — queue if needed (out of scope for v1).

---

## Stage 6 — Email Template Manager (Super-Admin)

**Scope**
- Table `email_templates` (id, key unique, name, subject, html_body, text_body, variables jsonb, is_active, updated_at).
- Seed with `application_received` template.
- Super-admin screen `/admin/email-templates`: list, edit (rich text), preview with sample data, send test email.
- `send-candidate-email` reads from this table at runtime instead of hardcoded strings.

**End result:** Super admin manages all candidate-facing email copy without code deploys.

**Risks**
- Variable mismatches between template and trigger context — validate `{{vars}}` against allowlist per template key.
- Test sends could be abused — restrict to super_admin and rate-limit.

---

## Stage 7 — Per-Company Sending Domains (future)

**Scope**
- Add `email_domain`, `email_domain_verified`, DKIM records to `companies`.
- Resend "Domains API" integration: create domain on company onboarding, surface DNS records to super admin, poll verification.
- `send-candidate-email` picks company domain when verified, else falls back to rizonhire.com.

**End result:** Candidates receive emails from the hiring company's own domain, improving trust and deliverability.

**Risks**
- Resend domain quota / cost per company.
- DNS support burden — needs clear in-app instructions and verification status UI.
- Bounce/complaint webhooks must be per-domain to keep one company's reputation from affecting others.

---

## Cross-Cutting Improvements

- **Audit log table** introduced in Stage 1 (`admin_actions`) — capture every super-admin mutation (company edit, user add/remove, policy change, template edit). Pays off across all stages.
- **Role model**: today `app_role` is global. Consider `company_users(company_id, user_id, role)` so the same user could belong to multiple companies later — decide before Stage 2 ships.
- **Email observability**: add a "Recent emails" view per company in Stage 6 so admins can debug delivery without DB access.
- **Testing**: add Playwright coverage for the new admin flows (Stages 1, 2, 6) since they touch privileged actions.

## Technical Notes

- All new tables: RLS on, super-admin policies via `has_role(auth.uid(), 'super_admin')`, tenant policies via `company_id = get_user_company_id(auth.uid())`.
- Edge functions go in the **external** Supabase project per existing convention; `VITE_SUPABASE_URL` already points there.
- Reuse `RichTextEditor` for policies + templates; render with DOMPurify wrapper.
- Stage ordering allows shipping value early (1→2→3 unblock admin workflows) while email work (5→6→7) proceeds in parallel once Resend domain is verified.
