ALTER TABLE public.company_email_templates
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS company_email_templates_company_active_idx
  ON public.company_email_templates (company_id, is_active, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  recipient_email text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  status text NOT NULL,
  provider_message_id text,
  error_message text,
  context jsonb,
  from_address text,
  reply_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_address text,
  ADD COLUMN IF NOT EXISTS reply_to text;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_send_log_company_idx
  ON public.email_send_log (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_send_log_template_idx
  ON public.email_send_log (template_key, created_at DESC);

CREATE INDEX IF NOT EXISTS email_send_log_company_candidate_idx
  ON public.email_send_log (company_id, candidate_id, created_at DESC)
  WHERE candidate_id IS NOT NULL;

DROP POLICY IF EXISTS "Super admins view all email logs" ON public.email_send_log;
CREATE POLICY "Super admins view all email logs"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (public.has_role((select auth.uid()), 'super_admin'));

DROP POLICY IF EXISTS "Company members view own logs" ON public.email_send_log;
CREATE POLICY "Company members view own logs"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id((select auth.uid())));

GRANT SELECT, INSERT, UPDATE ON public.company_email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.company_email_templates TO service_role;
GRANT SELECT ON public.email_send_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_send_log TO service_role;
