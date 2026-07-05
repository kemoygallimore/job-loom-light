CREATE TABLE IF NOT EXISTS public.company_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_email_templates_company_key_unique UNIQUE (company_id, key)
);

ALTER TABLE public.company_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can view email templates" ON public.company_email_templates;
CREATE POLICY "Company users can view email templates"
ON public.company_email_templates
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id((select auth.uid())));

DROP POLICY IF EXISTS "Company users can create email templates" ON public.company_email_templates;
CREATE POLICY "Company users can create email templates"
ON public.company_email_templates
FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id((select auth.uid())));

DROP POLICY IF EXISTS "Company users can update email templates" ON public.company_email_templates;
CREATE POLICY "Company users can update email templates"
ON public.company_email_templates
FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id((select auth.uid())))
WITH CHECK (company_id = public.get_user_company_id((select auth.uid())));

GRANT SELECT, INSERT, UPDATE ON public.company_email_templates TO authenticated;

DROP TRIGGER IF EXISTS update_company_email_templates_updated_at ON public.company_email_templates;
CREATE TRIGGER update_company_email_templates_updated_at
  BEFORE UPDATE ON public.company_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.seed_candidate_rejected_email_template(p_company_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.company_email_templates (
    company_id,
    key,
    name,
    subject,
    html_body,
    text_body,
    variables,
    is_active
  )
  VALUES (
    p_company_id,
    'candidate_rejected',
    'Candidate Rejected',
    'Update on your application for {{job_title}}',
    '<p>Hi {{candidate_name}},</p><p>Thank you for your interest in the <strong>{{job_title}}</strong> role at <strong>{{company_name}}</strong> and for taking the time to share your background with us.</p><p>After reviewing your application, we have decided to move forward with other candidates whose experience more closely matches our current needs.</p><p>We appreciate your interest in {{company_name}} and wish you all the best in your job search.</p><p>Kind regards,<br/>The {{company_name}} Hiring Team</p>',
    'Hi {{candidate_name}},

Thank you for your interest in the {{job_title}} role at {{company_name}} and for taking the time to share your background with us.

After reviewing your application, we have decided to move forward with other candidates whose experience more closely matches our current needs.

We appreciate your interest in {{company_name}} and wish you all the best in your job search.

Kind regards,
The {{company_name}} Hiring Team',
    '["candidate_name", "company_name", "job_title"]'::jsonb,
    true
  )
  ON CONFLICT (company_id, key) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.seed_candidate_rejected_email_template(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_candidate_rejected_email_template(uuid) TO service_role;

SELECT public.seed_candidate_rejected_email_template(id)
FROM public.companies;

CREATE OR REPLACE FUNCTION public.seed_company_email_templates_on_company_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.seed_candidate_rejected_email_template(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_company_email_templates_on_company_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_company_email_templates_after_company_insert ON public.companies;
CREATE TRIGGER seed_company_email_templates_after_company_insert
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_company_email_templates_on_company_insert();
