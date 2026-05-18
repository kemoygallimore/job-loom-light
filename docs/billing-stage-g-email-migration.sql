-- Stages 5 & 6: Candidate emails + Template manager
-- Run in EXTERNAL Supabase SQL editor.

-- 1. Templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage email templates"
  ON public.email_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Send log
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  recipient_email text NOT NULL,
  company_id uuid,
  application_id uuid,
  status text NOT NULL,            -- queued | sent | failed
  provider_message_id text,
  error_message text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_send_log_company_idx ON public.email_send_log (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_log_template_idx ON public.email_send_log (template_key, created_at DESC);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view all email logs"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Company members view own logs"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- 3. Seed default template
INSERT INTO public.email_templates (key, name, subject, html_body, text_body, variables)
VALUES (
  'application_received',
  'Application Received',
  'Thanks for applying to {{job_title}} at {{company_name}}',
  '<p>Hi {{candidate_name}},</p><p>Thank you for applying for the <strong>{{job_title}}</strong> role at <strong>{{company_name}}</strong>. Our team has received your application and will review it shortly.</p><p>If your background matches what we are looking for, someone from {{company_name}} will reach out to you directly.</p><p>Best regards,<br/>The {{company_name}} Hiring Team</p>',
  'Hi {{candidate_name}}, thank you for applying for {{job_title}} at {{company_name}}. We have received your application and will review it shortly.',
  '["candidate_name","company_name","job_title"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
