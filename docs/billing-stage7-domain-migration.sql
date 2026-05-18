-- Stage 7: Per-company sending domains
-- Run in external Supabase project SQL editor.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email_from_name text,
  ADD COLUMN IF NOT EXISTS email_reply_to text,
  ADD COLUMN IF NOT EXISTS email_domain text,
  ADD COLUMN IF NOT EXISTS email_domain_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS email_provider_domain_id text,
  ADD COLUMN IF NOT EXISTS email_domain_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_domain_records jsonb;

-- Status validation via trigger (avoid CHECK for forward-compat)
CREATE OR REPLACE FUNCTION public.validate_email_domain_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.email_domain_status NOT IN ('unverified','pending','verified','failed') THEN
    RAISE EXCEPTION 'Invalid email_domain_status: %', NEW.email_domain_status;
  END IF;
  IF NEW.email_domain IS NOT NULL THEN
    NEW.email_domain := lower(trim(NEW.email_domain));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_email_domain_status ON public.companies;
CREATE TRIGGER trg_validate_email_domain_status
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.validate_email_domain_status();

CREATE UNIQUE INDEX IF NOT EXISTS companies_email_domain_unique
  ON public.companies (email_domain) WHERE email_domain IS NOT NULL;

-- Audit log
CREATE TABLE IF NOT EXISTS public.company_email_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL, -- registered | verified | failed | refreshed | removed
  actor_user_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_email_domain_events_company_idx
  ON public.company_email_domain_events (company_id, created_at DESC);

ALTER TABLE public.company_email_domain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins view domain events" ON public.company_email_domain_events;
CREATE POLICY "Super admins view domain events"
  ON public.company_email_domain_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins insert domain events" ON public.company_email_domain_events;
CREATE POLICY "Super admins insert domain events"
  ON public.company_email_domain_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- email_send_log: capture actual from/reply-to for audit
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS from_address text,
  ADD COLUMN IF NOT EXISTS reply_to text;
