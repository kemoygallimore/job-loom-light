-- Stage 1 — Editable Companies & Super-Admin User Management
-- Run in the external Supabase SQL editor.

-- 1. Profiles: soft-deactivate flag (preferred over hard delete of auth.users).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_company_active
  ON public.profiles(company_id) WHERE is_active;

-- 2. Allow super-admins to update profile rows (name) and user_roles (role swap, deactivation).
-- Existing policies cover SELECT; add UPDATE/DELETE for super-admins.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Super admins can update profiles'
  ) THEN
    CREATE POLICY "Super admins can update profiles" ON public.profiles
      FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(),'super_admin'))
      WITH CHECK (public.has_role(auth.uid(),'super_admin'));
  END IF;
END $$;

-- user_roles: super-admin update + delete (the edge function uses service role,
-- but these policies make ad-hoc fixes from the SQL editor safe and explicit).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Super admins can delete user_roles'
  ) THEN
    CREATE POLICY "Super admins can delete user_roles" ON public.user_roles
      FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(),'super_admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_roles' AND policyname='Super admins can update user_roles'
  ) THEN
    CREATE POLICY "Super admins can update user_roles" ON public.user_roles
      FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(),'super_admin'))
      WITH CHECK (public.has_role(auth.uid(),'super_admin'));
  END IF;
END $$;

-- 3. Helper: count active seats currently consumed by a company.
CREATE OR REPLACE FUNCTION public.count_active_company_seats(_company_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.profiles
  WHERE company_id = _company_id AND is_active = true;
$$;

-- 4. Tenant admin role policies (used by Stage 2; safe to add now).
-- Allow admins of the same company to manage profiles inside their company via the edge function's RLS bypass.
-- (No public-facing RLS change here — the edge function uses service role and enforces caller role in code.)