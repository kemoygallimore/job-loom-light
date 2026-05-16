-- ============================================================================
-- Stage B — Subscription cycle dates
-- Run on the EXTERNAL Supabase project (SQL editor).
-- Safe to re-run.
-- ============================================================================

-- 1. Columns ----------------------------------------------------------------
ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_start_date date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS renewal_date            date,
  ADD COLUMN IF NOT EXISTS auto_renew              boolean NOT NULL DEFAULT true;

-- 2. Renewal-date trigger ---------------------------------------------------
-- Recompute renewal_date = subscription_start_date + 1 year whenever
-- the row is inserted or the start date changes, UNLESS renewal_date was
-- explicitly set in the same statement (i.e. super-admin overrode it).
CREATE OR REPLACE FUNCTION public.set_renewal_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.renewal_date IS NULL THEN
      NEW.renewal_date := NEW.subscription_start_date + INTERVAL '1 year';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.subscription_start_date IS DISTINCT FROM OLD.subscription_start_date
       AND NEW.renewal_date IS NOT DISTINCT FROM OLD.renewal_date THEN
      NEW.renewal_date := NEW.subscription_start_date + INTERVAL '1 year';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_subscriptions_renewal_date
  ON public.company_subscriptions;
CREATE TRIGGER trg_company_subscriptions_renewal_date
  BEFORE INSERT OR UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_renewal_date();

-- 3. Backfill existing rows -------------------------------------------------
UPDATE public.company_subscriptions cs
SET subscription_start_date = COALESCE(
      cs.subscription_start_date,
      (SELECT c.created_at::date FROM public.companies c WHERE c.id = cs.company_id),
      current_date
    )
WHERE cs.subscription_start_date IS NULL;

UPDATE public.company_subscriptions
SET renewal_date = subscription_start_date + INTERVAL '1 year'
WHERE renewal_date IS NULL;

-- 4. Ensure every company has a subscription row (needed for cycle dates) --
INSERT INTO public.company_subscriptions (company_id, subscription_start_date, auto_renew)
SELECT c.id, c.created_at::date, true
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_subscriptions s WHERE s.company_id = c.id
);
