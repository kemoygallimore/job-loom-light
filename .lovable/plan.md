# Stage 7 — Per-Company Sending Domains

Goal: let each tenant send candidate emails from their own verified domain (e.g. `careers@acme.com`) instead of the shared `no-reply@rizonhire.com`. Falls back automatically when a company has no verified domain.

## End result

- Super-admin can register a sending domain for a company, see DKIM/SPF records to publish, trigger verification, and see verification status.
- Once verified, all candidate emails for that company are sent from the company's domain with a configurable "from name" and reply-to.
- Companies without a verified domain keep using the shared RizonHire sender (no regression).
- All sends are logged with the actual `from_address` used, so deliverability can be audited per tenant.

## Scope

1. **Schema** (`docs/billing-stage7-domain-migration.sql`)
   - Add to `companies`: `email_from_name`, `email_reply_to`, `email_domain`, `email_domain_status` (`unverified | pending | verified | failed`), `email_provider_domain_id`, `email_domain_last_checked_at`, `email_domain_records jsonb`.
   - New table `company_email_domain_events` (audit log) with RLS (super-admin only).
   - Unique index on `lower(email_domain)` to prevent collisions.

2. **Edge function `manage-company-domain`** (external Supabase, super-admin check inside)
   - Actions: `register`, `verify`, `refresh_status`, `remove` — wraps Resend Domains API.
   - Persists status, DNS records (DKIM/SPF/MX), and provider id back to `companies`.
   - Writes one row to `company_email_domain_events` per action.

3. **`send-candidate-email` update**
   - Resolve sender per `company_id`: if `email_domain_status = 'verified'`, build `from = "${from_name || company.name} <no-reply@${email_domain}>"` and set `reply_to`.
   - Otherwise keep the existing `RIZONHIRE_FROM_EMAIL` fallback.
   - Add `from_address` and `reply_to` columns to `email_send_log` for audit.

4. **Super-admin UI — `/admin/companies/:id` "Email Domain" tab**
   - Inputs: domain, from name, reply-to.
   - Buttons: Register, Refresh status, Verify, Remove.
   - Status badge, last checked time, copy-friendly DNS records table from Resend.

5. **Tenant read-only card** on `/team`: shows current sending domain + status so admins know what address candidates see.

6. **Docs**
   - `docs/billing-stage7-domain-deploy.md`: migration, function deploy, Resend API key scope, operator runbook.
   - Update `docs/01-features.md` and `docs/02-technical.md`.

## Out of scope

- Per-template per-company overrides.
- Webhook ingestion of Resend bounce/complaint events.
- Multiple sending domains per company.
- Automatic DNS provisioning.

## Risks & bottlenecks

- **Resend quota**: each verified domain counts against the account's domain limit. At scale this needs a paid tier or subaccounts.
- **DNS propagation lag**: verification can take minutes to hours. Verify must be idempotent; poll on demand only.
- **Email reputation**: each new domain starts cold; document warm-up in the runbook.
- **API key scope**: `RESEND_API_KEY` must have `domains:write`. If the current key is send-only, registration will 403 — verify before rollout.
- **Stale status**: a tenant could remove DNS after verification. Add a "last checked > 24h" warning in UI; a daily refresh cron can come later.
- **Domain collisions**: enforced at DB level via unique index, surfaced as a clear UI error.

## Improvements worth pairing

- Extract a `sender_identity` resolver in the edge function so future flows (invoice emails, future auth emails) reuse the same lookup.
- Extend `email_send_log` with `from_address`, `reply_to`, `domain_status_at_send` for deliverability debugging.
- Feature flag `feature_per_company_domain` on `companies` for dark-launching to one tenant first.

## Manual actions after merge

1. Run `docs/billing-stage7-domain-migration.sql` on the external Supabase project.
2. Confirm `RESEND_API_KEY` has `domains:write` (rotate if not).
3. Deploy: `supabase functions deploy manage-company-domain send-candidate-email --project-ref <EXTERNAL_REF>`.
4. Smoke test: register a throwaway subdomain, publish DNS, verify, send a test from the Stage 6 template manager.
