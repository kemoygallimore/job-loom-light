CREATE TABLE IF NOT EXISTS public.company_features (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  feature_assessment boolean NOT NULL DEFAULT false,
  feature_public_careers boolean NOT NULL DEFAULT true,
  feature_guest_feedback boolean NOT NULL DEFAULT true,
  feature_email_notifications boolean NOT NULL DEFAULT false,
  feature_custom_email_domain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manage features" ON public.company_features;
CREATE POLICY "Super admin manage features"
  ON public.company_features
  FOR ALL
  USING (public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Tenant reads own features" ON public.company_features;
CREATE POLICY "Tenant reads own features"
  ON public.company_features
  FOR SELECT
  USING (company_id = public.get_user_company_id((SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.is_feature_enabled(_company_id uuid, _feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enabled boolean;
BEGIN
  EXECUTE format(
    'SELECT %I FROM public.company_features WHERE company_id = $1',
    'feature_' || _feature
  ) INTO enabled USING _company_id;

  RETURN coalesce(enabled, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_feedback_context(_token text)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  candidate_id uuid,
  job_id uuid,
  application_id uuid,
  expires_at timestamptz,
  candidate_name text,
  job_title text,
  hiring_manager text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fl.id,
    fl.company_id,
    fl.candidate_id,
    fl.job_id,
    fl.application_id,
    fl.expires_at,
    c.name AS candidate_name,
    j.title AS job_title,
    j.hiring_manager
  FROM public.feedback_links fl
  JOIN public.candidates c
    ON c.id = fl.candidate_id
   AND c.company_id = fl.company_id
  JOIN public.jobs j
    ON j.id = fl.job_id
   AND j.company_id = fl.company_id
  WHERE fl.token = _token
    AND fl.expires_at > now()
    AND public.is_feature_enabled(fl.company_id, 'guest_feedback')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_feedback(
  _token text,
  _feedback_by text,
  _summary text,
  _ratings jsonb,
  _scorecard_version_id uuid,
  _scorecard_snapshot jsonb,
  _panelist_average numeric,
  _consents jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link record;
  _feedback_id uuid;
BEGIN
  SELECT fl.id, fl.company_id, fl.candidate_id, fl.job_id, fl.application_id, fl.expires_at, j.hiring_manager
    INTO _link
  FROM public.feedback_links fl
  LEFT JOIN public.jobs j
    ON j.id = fl.job_id
   AND j.company_id = fl.company_id
  WHERE fl.token = _token
    AND fl.expires_at > now()
    AND public.is_feature_enabled(fl.company_id, 'guest_feedback')
  LIMIT 1;

  IF _link.id IS NULL THEN
    RAISE EXCEPTION 'This feedback link is invalid or has expired.';
  END IF;
  IF coalesce(trim(_feedback_by), '') = '' OR coalesce(trim(_summary), '') = '' THEN
    RAISE EXCEPTION 'Your name and summary are required.';
  END IF;
  IF _panelist_average < 1 OR _panelist_average > 5 THEN
    RAISE EXCEPTION 'Feedback rating is invalid.';
  END IF;

  INSERT INTO public.interview_feedback (
    candidate_id,
    job_id,
    company_id,
    feedback_text,
    feedback_by,
    feedback_date,
    hiring_manager,
    summary,
    scorecard_version_id,
    scorecard_snapshot,
    ratings,
    panelist_average,
    rating,
    source
  ) VALUES (
    _link.candidate_id,
    _link.job_id,
    _link.company_id,
    trim(_summary),
    trim(_feedback_by),
    now()::date,
    _link.hiring_manager,
    trim(_summary),
    _scorecard_version_id,
    _scorecard_snapshot,
    _ratings,
    _panelist_average,
    round(_panelist_average)::smallint,
    'guest'
  )
  RETURNING id INTO _feedback_id;

  RETURN _feedback_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_feedback_context(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_feedback_context(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_public_feedback(text, text, text, jsonb, uuid, jsonb, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_feedback(text, text, text, jsonb, uuid, jsonb, numeric, jsonb) TO anon;
