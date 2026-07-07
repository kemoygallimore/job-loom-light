CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  public_id text NOT NULL UNIQUE,
  schema jsonb NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.lead_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_snapshot jsonb NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_form_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.lead_form_submissions(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  field_id text NOT NULL,
  bucket text NOT NULL,
  object_key text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (
    file_type IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/webp'
    )
  ),
  file_size bigint NOT NULL CHECK (file_size <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_forms_company_idx ON public.lead_forms(company_id);
CREATE INDEX IF NOT EXISTS lead_forms_public_id_idx ON public.lead_forms(public_id);
CREATE INDEX IF NOT EXISTS lead_form_submissions_company_idx ON public.lead_form_submissions(company_id);
CREATE INDEX IF NOT EXISTS lead_form_submissions_form_created_idx ON public.lead_form_submissions(form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_form_uploads_submission_idx ON public.lead_form_uploads(submission_id);

ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_form_uploads ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_lead_forms_updated_at ON public.lead_forms;
CREATE TRIGGER update_lead_forms_updated_at
  BEFORE UPDATE ON public.lead_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_lead_form_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  form_count integer;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id::text));

  SELECT count(*)
  INTO form_count
  FROM public.lead_forms
  WHERE company_id = NEW.company_id
    AND deleted_at IS NULL
    AND id <> NEW.id;

  IF form_count >= 5 THEN
    RAISE EXCEPTION 'Each company can create a maximum of 5 forms';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_lead_form_limit ON public.lead_forms;
CREATE TRIGGER enforce_lead_form_limit
  BEFORE INSERT OR UPDATE OF company_id, deleted_at ON public.lead_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lead_form_limit();

CREATE OR REPLACE FUNCTION public.is_active_lead_form(_form_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lead_forms lf
    WHERE lf.id = _form_id
      AND lf.company_id = _company_id
      AND lf.status = 'active'
      AND lf.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.get_public_lead_form(_public_id text)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  title text,
  description text,
  schema jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lf.id, lf.company_id, lf.title, lf.description, lf.schema
  FROM public.lead_forms lf
  WHERE lf.public_id = _public_id
    AND lf.status = 'active'
    AND lf.deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_lead_form_submission(_submission_id uuid, _form_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lead_form_submissions lfs
    WHERE lfs.id = _submission_id
      AND lfs.form_id = _form_id
      AND lfs.company_id = _company_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_lead_form(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_lead_form(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_lead_form_submission(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_lead_form(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_lead_form(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_lead_form_submission(uuid, uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Company users view lead forms" ON public.lead_forms;
CREATE POLICY "Company users view lead forms"
ON public.lead_forms
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id((select auth.uid())));

DROP POLICY IF EXISTS "Company users create lead forms" ON public.lead_forms;
CREATE POLICY "Company users create lead forms"
ON public.lead_forms
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id((select auth.uid()))
  AND created_by = (select auth.uid())
);

DROP POLICY IF EXISTS "Company users update lead forms" ON public.lead_forms;
CREATE POLICY "Company users update lead forms"
ON public.lead_forms
FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id((select auth.uid())))
WITH CHECK (company_id = public.get_user_company_id((select auth.uid())));

DROP POLICY IF EXISTS "Company users view lead submissions" ON public.lead_form_submissions;
CREATE POLICY "Company users view lead submissions"
ON public.lead_form_submissions
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id((select auth.uid())));

DROP POLICY IF EXISTS "Company users update lead submissions" ON public.lead_form_submissions;
CREATE POLICY "Company users update lead submissions"
ON public.lead_form_submissions
FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id((select auth.uid())))
WITH CHECK (company_id = public.get_user_company_id((select auth.uid())));

DROP POLICY IF EXISTS "Public submits active lead forms" ON public.lead_form_submissions;
CREATE POLICY "Public submits active lead forms"
ON public.lead_form_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'new'
  AND public.is_active_lead_form(form_id, company_id)
);

DROP POLICY IF EXISTS "Company users view lead uploads" ON public.lead_form_uploads;
CREATE POLICY "Company users view lead uploads"
ON public.lead_form_uploads
FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id((select auth.uid())));

DROP POLICY IF EXISTS "Public records active lead uploads" ON public.lead_form_uploads;
CREATE POLICY "Public records active lead uploads"
ON public.lead_form_uploads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_active_lead_form(form_id, company_id)
  AND public.is_lead_form_submission(submission_id, form_id, company_id)
);

GRANT SELECT, INSERT, UPDATE ON public.lead_forms TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lead_form_submissions TO authenticated;
GRANT INSERT ON public.lead_form_submissions TO anon;
GRANT SELECT, INSERT ON public.lead_form_uploads TO authenticated;
GRANT INSERT ON public.lead_form_uploads TO anon;
