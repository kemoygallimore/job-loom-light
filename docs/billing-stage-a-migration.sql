-- ============================================================================
-- Stage A — Billing profile foundation
-- Run this in your EXTERNAL Supabase project (SQL editor).
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS where possible.
-- ============================================================================

-- 1. Customer code sequence -------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq START 1;

CREATE OR REPLACE FUNCTION public.set_customer_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    NEW.customer_code := 'CUST-' || lpad(nextval('public.customer_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Table ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_billing_profiles (
  company_id            uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  legal_name            text,
  billing_email         text NOT NULL DEFAULT '',
  billing_contact_name  text,
  billing_phone         text,
  billing_address       text,
  trn                   text,
  customer_code         text UNIQUE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 3. Triggers ---------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_company_billing_profiles_customer_code
  ON public.company_billing_profiles;
CREATE TRIGGER trg_company_billing_profiles_customer_code
  BEFORE INSERT ON public.company_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_code();

DROP TRIGGER IF EXISTS trg_company_billing_profiles_updated_at
  ON public.company_billing_profiles;
CREATE TRIGGER trg_company_billing_profiles_updated_at
  BEFORE UPDATE ON public.company_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS --------------------------------------------------------------------
ALTER TABLE public.company_billing_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage all billing profiles"
  ON public.company_billing_profiles;
CREATE POLICY "Super admins manage all billing profiles"
  ON public.company_billing_profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Company admins view own billing profile"
  ON public.company_billing_profiles;
CREATE POLICY "Company admins view own billing profile"
  ON public.company_billing_profiles
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Company admins update own billing profile"
  ON public.company_billing_profiles;
CREATE POLICY "Company admins update own billing profile"
  ON public.company_billing_profiles
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

-- 5. Backfill ---------------------------------------------------------------
-- One row per company that doesn't already have one. Pull billing_email from
-- the first admin profile in that company; fall back to empty string.
INSERT INTO public.company_billing_profiles (company_id, legal_name, billing_email)
SELECT
  c.id,
  c.name,
  COALESCE(
    (SELECT p.email
       FROM public.profiles p
       JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.company_id = c.id AND ur.role = 'admin'
      ORDER BY p.created_at ASC
      LIMIT 1),
    ''
  )
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_billing_profiles bp WHERE bp.company_id = c.id
);

-- 6. Drop legacy invoice-identity columns on companies (added in Stage 6) ---
ALTER TABLE public.companies DROP COLUMN IF EXISTS email;
ALTER TABLE public.companies DROP COLUMN IF EXISTS address;
