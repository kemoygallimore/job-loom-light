-- Platform-wide policies (owned by RizonHire, visible to all tenants)
-- Run in the external Supabase SQL editor.

-- Clean up legacy per-company policy tables if they were ever created
DROP TRIGGER IF EXISTS trg_company_policy_snapshot ON public.company_policies;
DROP FUNCTION IF EXISTS public.snapshot_company_policy() CASCADE;
DROP FUNCTION IF EXISTS public.get_public_company_policy(text) CASCADE;
DROP TABLE IF EXISTS public.company_policy_versions CASCADE;
DROP TABLE IF EXISTS public.company_policies CASCADE;

-- Main table
CREATE TABLE IF NOT EXISTS public.platform_policies (
  key text PRIMARY KEY,
  title text NOT NULL,
  content_html text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.platform_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_policies' AND policyname='Super admins manage platform policies') THEN
    CREATE POLICY "Super admins manage platform policies"
      ON public.platform_policies
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_policies' AND policyname='Authenticated users read platform policies') THEN
    CREATE POLICY "Authenticated users read platform policies"
      ON public.platform_policies
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- History / audit table
CREATE TABLE IF NOT EXISTS public.platform_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  title text NOT NULL,
  content_html text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.platform_policy_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_policy_versions' AND policyname='Super admins read policy versions') THEN
    CREATE POLICY "Super admins read policy versions"
      ON public.platform_policy_versions
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- Snapshot trigger: every insert/update records a version row
CREATE OR REPLACE FUNCTION public.snapshot_platform_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.platform_policy_versions(key, title, content_html, updated_by)
  VALUES (NEW.key, NEW.title, NEW.content_html, NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_policy_snapshot ON public.platform_policies;
CREATE TRIGGER trg_platform_policy_snapshot
  AFTER INSERT OR UPDATE ON public.platform_policies
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_platform_policy();

-- Public RPC: anyone (signed in or not) can read a policy by key
CREATE OR REPLACE FUNCTION public.get_public_platform_policy(_key text)
RETURNS TABLE (key text, title text, content_html text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT key, title, content_html, updated_at
  FROM public.platform_policies
  WHERE key = _key
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_platform_policy(text) TO anon, authenticated;

-- Seed the Data Protection Agreement (skip if it already exists)
INSERT INTO public.platform_policies (key, title, content_html)
VALUES (
  'data_protection',
  'Data Protection Agreement',
  '<p>RizonHire is committed to protecting the privacy and personal information of every candidate who applies through our applicant tracking platform.</p><h2>1. Information we collect</h2><ul><li>Your full name, email address, and phone number.</li><li>Your country, street address, and parish/state.</li><li>Your highest education level.</li><li>Your résumé/CV file.</li><li>Optional LinkedIn profile URL.</li></ul><h2>2. Why we collect it</h2><p>Your information is collected solely to allow hiring teams to review your candidacy, contact you about the role, and manage you through the hiring process. RizonHire does not sell, rent, or share your personal data with third parties for marketing purposes.</p><h2>3. Who can access your data</h2><ul><li>Authorised recruiters and hiring team members within the company you applied to.</li><li>A small number of RizonHire platform administrators, only when strictly necessary for support, security, or legal compliance.</li></ul><h2>4. How your data is stored</h2><p>Personal information is stored in a secure database protected by row-level security policies that enforce tenant isolation. Résumés and uploaded documents are stored in private cloud storage and can only be accessed via short-lived signed links generated for authorised users.</p><h2>5. Retention</h2><p>We retain your application data for as long as needed for recruitment and record-keeping purposes, or until you request deletion.</p><h2>6. Your rights</h2><ul><li>Request a copy of the personal information we hold about you.</li><li>Request correction of any inaccurate information.</li><li>Request deletion of your application and associated data.</li><li>Withdraw your consent to processing at any time.</li></ul><h2>7. Security</h2><p>RizonHire uses industry-standard encryption in transit (HTTPS/TLS) and at rest. Access to administrative systems requires authenticated accounts with role-based permissions.</p>'
)
ON CONFLICT (key) DO NOTHING;