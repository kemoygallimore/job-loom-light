-- Run on the EXTERNAL Supabase project (jfiyvvigvknfemqfnucl).
-- Stage 5 + annual-only migration for already-shipped Stages 2-4.

-- =========================================================
-- PART A: Annual-only billing (Stages 2, 3)
-- =========================================================
ALTER TABLE public.plan_defaults
  RENAME COLUMN monthly_price_cents TO annual_price_cents;

ALTER TABLE public.company_subscriptions
  DROP COLUMN IF EXISTS billing_cycle;

ALTER TABLE public.company_subscriptions
  RENAME COLUMN override_monthly_price_cents TO override_annual_price_cents;

-- =========================================================
-- PART B: Stage 5 — non-core feature toggles
-- =========================================================
CREATE TABLE IF NOT EXISTS public.company_features (
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

DROP POLICY IF EXISTS "Super admin manage features" ON public.company_features;
CREATE POLICY "Super admin manage features"
  ON public.company_features FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Tenant reads own features" ON public.company_features;
CREATE POLICY "Tenant reads own features"
  ON public.company_features FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Backfill from plan_defaults for existing companies
INSERT INTO public.company_features (
  company_id,
  feature_assessment, feature_public_careers, feature_guest_feedback,
  feature_email_notifications, feature_custom_email_domain
)
SELECT c.id, false, true, true, false, false
FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

-- Helper used by anon-context lookups (PublicFeedback, etc.)
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

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(uuid, text) TO anon, authenticated;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_company_features_updated_at ON public.company_features;
CREATE TRIGGER trg_company_features_updated_at
  BEFORE UPDATE ON public.company_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();