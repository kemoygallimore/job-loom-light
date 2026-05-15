# Stage 5 + Annual-Only Migration + Improvements doc

This plan does three things in one approval:
1. Apply the annual-only billing change to already-shipped Stages 2–4.
2. Implement Stage 5 (non-core feature toggles).
3. Drop a new `docs/improvements.md` file with concrete enhancement ideas for the rest of the build.

All schema changes live on the **external Supabase project** (same one as `plan_defaults`, `company_subscriptions`, `company_addons`). Because Lovable Cloud cannot run those migrations, the SQL is provided here and you run it manually before the frontend wires up.

---

## Part A — Annual-only migration (Stages 2, 3, 4)

### SQL to run on external Supabase

```sql
-- Stage 2: rename column on plan_defaults
ALTER TABLE public.plan_defaults
  RENAME COLUMN monthly_price_cents TO annual_price_cents;

-- Stage 3: drop billing_cycle, rename override price column
ALTER TABLE public.company_subscriptions
  DROP COLUMN IF EXISTS billing_cycle;
ALTER TABLE public.company_subscriptions
  RENAME COLUMN override_monthly_price_cents TO override_annual_price_cents;
```

(No data migration needed — the existing values are simply re-interpreted as annual.)

### Frontend changes that follow the rename

- `src/pages/admin/AdminPricing.tsx`
  - Interface field `monthly_price_cents` → `annual_price_cents`.
  - Label "Monthly price" → "Annual price".
- `src/pages/admin/AdminCompanyDetail.tsx`
  - `Subscription` interface: drop `billing_cycle`, rename `override_monthly_price_cents` → `override_annual_price_cents`.
  - `PlanDefaults` interface: rename `monthly_price_cents` → `annual_price_cents`.
  - Remove the **Billing cycle** Select; relabel **Monthly price override** → **Annual price override**.
  - `saveSubscription` payload: drop `billing_cycle`, rename the price field.
  - `refresh()` default sub object: drop `billing_cycle`.

---

## Part B — Stage 5: Non-core feature toggles

### SQL to run on external Supabase

```sql
-- Per-tenant feature flags
CREATE TABLE public.company_features (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  feature_assessment            boolean NOT NULL DEFAULT false,
  feature_public_careers        boolean NOT NULL DEFAULT true,
  feature_guest_feedback        boolean NOT NULL DEFAULT true,
  feature_email_notifications   boolean NOT NULL DEFAULT false,
  feature_custom_email_domain   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manage features"
  ON public.company_features FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant reads own features"
  ON public.company_features FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Backfill from plan_defaults
INSERT INTO public.company_features (
  company_id,
  feature_assessment, feature_public_careers, feature_guest_feedback,
  feature_email_notifications, feature_custom_email_domain
)
SELECT c.id,
  pd.default_feature_assessment, pd.default_feature_public_careers, pd.default_feature_guest_feedback,
  pd.default_feature_email_notifications, pd.default_feature_custom_email_domain
FROM public.companies c, public.plan_defaults pd
ON CONFLICT (company_id) DO NOTHING;

-- Helper: true/false for a single feature
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_company_id uuid, _feature text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v boolean;
BEGIN
  EXECUTE format('SELECT %I FROM public.company_features WHERE company_id = $1', 'feature_' || _feature)
    INTO v USING _company_id;
  RETURN COALESCE(v, false);
END $$;

-- Gate the public careers RPC
CREATE OR REPLACE FUNCTION public.get_public_company_by_slug(_slug text)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug
  FROM public.companies c
  LEFT JOIN public.company_features f ON f.company_id = c.id
  WHERE c.slug = _slug
    AND COALESCE(f.feature_public_careers, true) = true
    AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.company_id = c.id AND j.status = 'open')
  LIMIT 1;
$$;
```

(Note: `feedback_links` public SELECT policy stays as-is for now — gating is done in the public feedback page UI by checking the feature flag on load. Public-feedback hard gate at the RLS level is listed in the improvements doc as a follow-up.)

### Frontend work

**New: `src/hooks/useFeatureFlags.ts`**
- Loads `company_features` for the current user's company once, exposes `{ assessment, public_careers, guest_feedback, email_notifications, custom_email_domain, loading }`.
- Used by sidebar and gated pages.

**Edits:**

- `src/components/AppLayout.tsx` — hide the **Assessment** sidebar link when `assessment` is off.
- `src/pages/Assessment.tsx` — render NotFound (or "Feature not available" panel) when off.
- `src/pages/careers/CareersPage.tsx` & `JobDetailsPage.tsx` — already get nothing back from `get_public_company_by_slug` when off; show a clean "This careers page is not available" state instead of a generic 404.
- `src/components/candidate/InterviewFeedback.tsx` (and any "Create guest feedback link" UI) — hide the create-link control when `guest_feedback` is off.
- `src/pages/feedback/PublicFeedback.tsx` — on load, look up the link's company and check `is_feature_enabled(company_id, 'guest_feedback')` via RPC; show "This feedback link is no longer available" if disabled.
- Email Notifications / Custom Email Domain — no functional impact yet; show a small "Coming soon" badge wherever they're surfaced.

**`src/pages/admin/AdminCompanyDetail.tsx` — new Features tab:**
- Third tab between Subscription and Add-ons.
- Loads `company_features` for the tenant; renders 5 `Switch` rows.
- Saves via `upsert` on `company_features` keyed by `company_id`.

---

## Part C — `docs/improvements.md`

Create a new file capturing follow-ups so they don't get lost. Contents include:

- **Hard-gate guest feedback at RLS** — extend `feedback_links` SELECT policy to join `company_features` instead of relying on UI.
- **Stripe/payment integration** for actual annual billing collection (currently invoices are records, not charges).
- **Audit log** for super-admin actions on subscriptions, add-ons, features (compliance).
- **Plan templates** — multiple `plan_defaults` rows ("Starter / Growth / Scale") instead of one global default; tenants pick a plan_id.
- **Proration logic** for mid-cycle add-on changes once Stripe is in.
- **Email notifications add-on activation** — when toggled on, configure transactional email provider per tenant.
- **Custom email domain** — DNS verification flow + per-tenant SMTP settings.
- **Feature-flag rollout improvements** — gradual rollout %, time-bounded toggles, audit trail of who flipped what.
- **Tenant self-service billing** — allow company admins (not just super admins) to view subscription, add-ons, and invoices on `/billing` (Stage 6 ships read-only; later allow upgrades).
- **Replace `companies.max_open_jobs`** entirely with the RPC once all callers are migrated; drop the column.
- **Webhook for invoice events** — outbound webhooks when invoices are issued/paid for tenant integrations.
- **PDF caching strategy** — short-lived signed URL cache to avoid hitting the Worker on every render.
- **Test coverage** — Vitest specs for `is_feature_enabled`, `get_company_job_limit`, and the feature-flag hook.

---

## Order of operations

1. You run **Part A** SQL on external Supabase, confirm.
2. You run **Part B** SQL on external Supabase, confirm.
3. I push all frontend changes (Stage 5 + the annual rename cleanup) in one commit.
4. I create `docs/improvements.md`.

## File map

- New: `src/hooks/useFeatureFlags.ts`, `docs/improvements.md`
- Edited: `src/pages/admin/AdminPricing.tsx`, `src/pages/admin/AdminCompanyDetail.tsx`, `src/components/AppLayout.tsx`, `src/pages/Assessment.tsx`, `src/pages/careers/CareersPage.tsx`, `src/pages/careers/JobDetailsPage.tsx`, `src/pages/feedback/PublicFeedback.tsx`, `src/components/candidate/InterviewFeedback.tsx`, `docs/plan.md` (mark Stage 5 done)