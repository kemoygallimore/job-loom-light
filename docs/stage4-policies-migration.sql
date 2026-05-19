-- Stage 4 — Per-company data protection policy
-- Run in the external Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.company_policies (
  company_id uuid PRIMARY KEY,
  data_protection_html text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.company_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_policies' AND policyname='Super admins manage policies') THEN
    CREATE POLICY "Super admins manage policies" ON public.company_policies
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'super_admin'))
      WITH CHECK (public.has_role(auth.uid(),'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_policies' AND policyname='Company users read own policy') THEN
    CREATE POLICY "Company users read own policy" ON public.company_policies
      FOR SELECT TO authenticated
      USING (company_id = public.get_user_company_id(auth.uid()));
  END IF;
END $$;

-- Optional history table (recommended for compliance).
CREATE TABLE IF NOT EXISTS public.company_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  data_protection_html text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.company_policy_versions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_policy_versions' AND policyname='Super admins read versions') THEN
    CREATE POLICY "Super admins read versions" ON public.company_policy_versions
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.snapshot_company_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_policy_versions(company_id, data_protection_html, updated_by)
  VALUES (NEW.company_id, NEW.data_protection_html, NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_policy_snapshot ON public.company_policies;
CREATE TRIGGER trg_company_policy_snapshot
  AFTER INSERT OR UPDATE ON public.company_policies
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_company_policy();

-- Public RPC: fetch policy by company slug (used by /legal/data-protection?company=slug).
CREATE OR REPLACE FUNCTION public.get_public_company_policy(_slug text)
RETURNS TABLE (company_id uuid, company_name text, data_protection_html text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, cp.data_protection_html, cp.updated_at
  FROM public.companies c
  LEFT JOIN public.company_policies cp ON cp.company_id = c.id
  WHERE c.slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_company_policy(text) TO anon, authenticated;