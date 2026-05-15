# Possible Improvements & Enhancements

Captured during Stage 5 build-out so they don't get lost. Roughly grouped by area.

## Security & access control
- **Hard-gate guest feedback at RLS.** Today `feedback_links` SELECT is open to anon while not expired; gating happens in the public page UI. Extend the policy to join `company_features` so disabling the feature instantly invalidates outstanding links at the database layer.
- **Hard-gate public careers at RLS.** The `get_public_company_by_slug` RPC could check `company_features.feature_public_careers` directly so the careers route returns nothing when off, even if a client bypasses the SDK.
- **Audit log** for super-admin actions on `company_subscriptions`, `company_addons`, `company_features` (who changed what, when). Required for SOC2-style compliance later.
- **Feature-flag history** — a small `company_features_audit` table that records the actor and old/new value on each toggle.

## Billing
- **Stripe (or Paddle) integration** for actually charging the annual amount. Today invoices are records, not charges.
- **Plan templates** — multiple `plan_defaults` rows ("Starter / Growth / Scale") instead of one global default; tenants pick a `plan_id`. Overrides still layer on top.
- **Proration** for mid-cycle add-on changes once a payment provider is in.
- **Webhook outbound** for invoice events so tenants can sync into their own accounting system.
- **Tenant self-service billing.** Stage 6 ships a read-only `/billing` view for tenants. Later allow tenant admins to add their own add-on packs (with a confirmation step) instead of routing through super admin.
- **PDF caching strategy.** Cache the signed R2 URL for ~10 minutes per `(invoice_id, pdf_version)` pair to avoid hitting the Worker on every render.
- **Currency support.** `plan_defaults.currency` exists, but invoices and overrides assume the same currency. Add a `currency` column to `company_subscriptions` and `invoices` for multi-currency tenants.

## Feature-flag rollout
- **Gradual rollout %** and time-bounded toggles ("enable for 10% of tenants", "enable until 2026-09-01").
- **Per-user overrides** for internal QA so staff accounts can preview a feature before tenant-wide rollout.

## Email add-ons
- **Email Notifications activation flow.** When toggled on for a tenant, provision a transactional email sender (Resend/Postmark) and surface delivery logs.
- **Custom email domain.** DNS verification flow (DKIM/SPF/Return-Path), per-tenant SMTP settings, status badge in the Features tab.

## Limits & legacy cleanup
- **Replace `companies.max_open_jobs` entirely** with `get_company_job_limit()`. Once every caller is migrated, drop the column and the sync write in `AdminCompanyDetail.saveSubscription`.
- **Soft warnings near limits.** When a tenant hits 80% of their job/seat limit, show a banner suggesting an add-on pack instead of waiting until they're blocked.

## Public careers polish
- **Custom domain per tenant** for the careers portal (e.g. `careers.acme.com`) once the custom-email-domain flow proves out the DNS verification pattern.
- **SEO**: per-tenant title, meta description, and JSON-LD `JobPosting` schema on each job page.

## Testing
- Vitest specs for `is_feature_enabled`, `get_company_job_limit`, `get_company_seat_limit`.
- Hook test for `useFeatureFlags` covering super-admin bypass and missing-row defaults.
- Component test asserting the Assessment route renders `NotFound` when the flag is off.

## Observability
- **Sentry (or equivalent)** for the React app and edge functions; today an unhandled error in `request-invoice-pdf` is invisible until a user reports it.
- **Edge-function timing logs** for the PDF Worker round-trip so we can spot R2 latency regressions.