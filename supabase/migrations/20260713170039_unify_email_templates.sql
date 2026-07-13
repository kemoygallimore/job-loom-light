-- Unified email templates: platform/global templates and company-owned
-- candidate templates now share public.email_templates. The legacy
-- company_email_templates table remains in place for rollback during this
-- phase, but active app writes move to email_templates.

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
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

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_default_for_purpose boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_templates_company_id_fkey'
      AND conrelid = 'public.email_templates'::regclass
  ) THEN
    ALTER TABLE public.email_templates
      ADD CONSTRAINT email_templates_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_templates_updated_by_fkey'
      AND conrelid = 'public.email_templates'::regclass
  ) THEN
    ALTER TABLE public.email_templates
      ADD CONSTRAINT email_templates_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_key_key;

DROP INDEX IF EXISTS public.email_templates_key_key;

ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_purpose_check;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_purpose_check
  CHECK (purpose IN ('general', 'form_link', 'video_screening', 'rejection'));

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_platform_key_unique_idx
  ON public.email_templates (key)
  WHERE company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_company_key_unique_idx
  ON public.email_templates (company_id, key)
  WHERE company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_one_company_default_per_purpose_idx
  ON public.email_templates (company_id, purpose)
  WHERE company_id IS NOT NULL
    AND is_default_for_purpose = true
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS email_templates_company_purpose_idx
  ON public.email_templates (company_id, purpose, is_active, name)
  WHERE company_id IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS email_templates_platform_purpose_idx
  ON public.email_templates (purpose, is_active, name)
  WHERE company_id IS NULL
    AND archived_at IS NULL;

DROP TRIGGER IF EXISTS email_templates_updated_at ON public.email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_templates (
  id,
  company_id,
  key,
  name,
  purpose,
  is_default_for_purpose,
  subject,
  html_body,
  text_body,
  variables,
  is_active,
  archived_at,
  updated_by,
  created_at,
  updated_at
)
SELECT
  cet.id,
  cet.company_id,
  cet.key,
  cet.name,
  cet.purpose,
  cet.is_default_for_purpose,
  cet.subject,
  cet.html_body,
  cet.text_body,
  cet.variables,
  cet.is_active,
  cet.archived_at,
  cet.updated_by,
  cet.created_at,
  cet.updated_at
FROM public.company_email_templates cet
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    key = EXCLUDED.key,
    name = EXCLUDED.name,
    purpose = EXCLUDED.purpose,
    is_default_for_purpose = EXCLUDED.is_default_for_purpose,
    subject = EXCLUDED.subject,
    html_body = EXCLUDED.html_body,
    text_body = EXCLUDED.text_body,
    variables = EXCLUDED.variables,
    is_active = EXCLUDED.is_active,
    archived_at = EXCLUDED.archived_at,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Super admins manage platform email templates" ON public.email_templates;
CREATE POLICY "Super admins manage platform email templates"
ON public.email_templates
FOR ALL TO authenticated
USING (
  company_id IS NULL
  AND public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
)
WITH CHECK (
  company_id IS NULL
  AND public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Company users view own email templates" ON public.email_templates;
CREATE POLICY "Company users view own email templates"
ON public.email_templates
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id((SELECT auth.uid())));

DROP POLICY IF EXISTS "Company users create own email templates" ON public.email_templates;
CREATE POLICY "Company users create own email templates"
ON public.email_templates
FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id((SELECT auth.uid())));

DROP POLICY IF EXISTS "Company users update own email templates" ON public.email_templates;
CREATE POLICY "Company users update own email templates"
ON public.email_templates
FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id((SELECT auth.uid())))
WITH CHECK (company_id = public.get_user_company_id((SELECT auth.uid())));

GRANT SELECT, INSERT, UPDATE ON public.email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_email_template(
  _company_id uuid DEFAULT NULL,
  _template_id uuid DEFAULT NULL,
  _template_key text DEFAULT NULL,
  _purpose text DEFAULT 'general',
  _include_inactive boolean DEFAULT false
) RETURNS TABLE (
  id uuid,
  company_id uuid,
  key text,
  name text,
  purpose text,
  subject text,
  html_body text,
  text_body text,
  variables jsonb,
  is_active boolean,
  is_default_for_purpose boolean,
  archived_at timestamptz,
  updated_at timestamptz,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _auth_user uuid := (SELECT auth.uid());
  _normalized_purpose text := coalesce(nullif(trim(_purpose), ''), 'general');
BEGIN
  IF _normalized_purpose NOT IN ('general', 'form_link', 'video_screening', 'rejection') THEN
    RAISE EXCEPTION 'Invalid email template purpose.';
  END IF;

  IF _auth_user IS NOT NULL
     AND _company_id IS NOT NULL
     AND _company_id <> public.get_user_company_id(_auth_user)
     AND NOT public.has_role(_auth_user, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Email template company is not accessible.';
  END IF;

  IF _auth_user IS NOT NULL
     AND _include_inactive
     AND NOT public.has_role(_auth_user, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Inactive email templates are not accessible.';
  END IF;

  IF _template_id IS NOT NULL AND _company_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.company_id, t.key, t.name, t.purpose, t.subject, t.html_body, t.text_body,
           t.variables, t.is_active, t.is_default_for_purpose, t.archived_at, t.updated_at,
           'company_template_id'::text
    FROM public.email_templates t
    WHERE t.id = _template_id
      AND t.company_id = _company_id
      AND t.purpose = _normalized_purpose
      AND (_include_inactive OR (t.is_active AND t.archived_at IS NULL))
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF _company_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.company_id, t.key, t.name, t.purpose, t.subject, t.html_body, t.text_body,
           t.variables, t.is_active, t.is_default_for_purpose, t.archived_at, t.updated_at,
           'company_default'::text
    FROM public.email_templates t
    WHERE t.company_id = _company_id
      AND t.purpose = _normalized_purpose
      AND t.is_default_for_purpose
      AND (_include_inactive OR (t.is_active AND t.archived_at IS NULL))
    ORDER BY t.updated_at DESC
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT t.id, t.company_id, t.key, t.name, t.purpose, t.subject, t.html_body, t.text_body,
         t.variables, t.is_active, t.is_default_for_purpose, t.archived_at, t.updated_at,
         'platform'::text
  FROM public.email_templates t
  WHERE t.company_id IS NULL
    AND (
      (_template_key IS NOT NULL AND t.key = _template_key)
      OR (_template_key IS NULL AND t.purpose = _normalized_purpose)
    )
    AND (_include_inactive OR (t.is_active AND t.archived_at IS NULL))
  ORDER BY
    CASE WHEN _template_key IS NOT NULL AND t.key = _template_key THEN 0 ELSE 1 END,
    t.is_default_for_purpose DESC,
    t.updated_at DESC,
    t.name ASC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_email_template(uuid, uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_email_template(uuid, uuid, text, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.seed_candidate_rejected_email_template(p_company_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.email_templates (
    company_id,
    key,
    name,
    purpose,
    is_default_for_purpose,
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
    'rejection',
    true,
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
  ON CONFLICT (company_id, key) WHERE (company_id IS NOT NULL) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.seed_candidate_rejected_email_template(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_candidate_rejected_email_template(uuid) TO service_role;
