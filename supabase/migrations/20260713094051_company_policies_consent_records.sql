-- Company-owned candidate privacy notices and consent evidence.

CREATE TABLE IF NOT EXISTS public.company_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL DEFAULT 'candidate_privacy_notice',
  draft_title text NOT NULL DEFAULT 'Candidate Privacy Notice',
  draft_content_html text NOT NULL DEFAULT '',
  published_version_id uuid,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, key),
  CHECK (key ~ '^[a-z0-9_]+$')
);

CREATE TABLE IF NOT EXISTS public.company_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  policy_id uuid NOT NULL REFERENCES public.company_policies(id) ON DELETE CASCADE,
  key text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  content_html text NOT NULL CHECK (length(trim(content_html)) > 0),
  published_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, version_number)
);

ALTER TABLE public.company_policies
  DROP CONSTRAINT IF EXISTS company_policies_published_version_fk;
ALTER TABLE public.company_policies
  ADD CONSTRAINT company_policies_published_version_fk
  FOREIGN KEY (published_version_id) REFERENCES public.company_policy_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS company_policies_company_idx
  ON public.company_policies(company_id);
CREATE INDEX IF NOT EXISTS company_policy_versions_company_key_idx
  ON public.company_policy_versions(company_id, key, published_at DESC);

DROP TRIGGER IF EXISTS update_company_policies_updated_at ON public.company_policies;
CREATE TRIGGER update_company_policies_updated_at
  BEFORE UPDATE ON public.company_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  submission_id uuid REFERENCES public.lead_form_submissions(id) ON DELETE SET NULL,
  screening_submission_id uuid REFERENCES public.screening_submissions(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.candidate_form_assignments(id) ON DELETE SET NULL,
  interview_feedback_id uuid REFERENCES public.interview_feedback(id) ON DELETE SET NULL,
  consent_key text NOT NULL,
  source_flow text NOT NULL,
  consent_text text NOT NULL CHECK (length(trim(consent_text)) > 0),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  platform_policy_key text,
  platform_policy_version_id uuid REFERENCES public.platform_policy_versions(id) ON DELETE SET NULL,
  platform_policy_title text,
  platform_policy_updated_at timestamptz,
  company_policy_key text,
  company_policy_version_id uuid REFERENCES public.company_policy_versions(id) ON DELETE SET NULL,
  company_policy_title text,
  company_policy_published_at timestamptz,
  page_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (consent_key ~ '^[a-z0-9_]+$'),
  CHECK (source_flow ~ '^[a-z0-9_]+$')
);

CREATE INDEX IF NOT EXISTS consent_records_company_created_idx
  ON public.consent_records(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS consent_records_candidate_created_idx
  ON public.consent_records(candidate_id, created_at DESC)
  WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS consent_records_application_idx
  ON public.consent_records(application_id)
  WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS consent_records_submission_idx
  ON public.consent_records(submission_id)
  WHERE submission_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reject_immutable_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Published policy versions and consent records are immutable.';
END;
$$;

DROP TRIGGER IF EXISTS prevent_company_policy_version_update ON public.company_policy_versions;
CREATE TRIGGER prevent_company_policy_version_update
  BEFORE UPDATE OR DELETE ON public.company_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_audit_change();

DROP TRIGGER IF EXISTS prevent_consent_record_update ON public.consent_records;
CREATE TRIGGER prevent_consent_record_update
  BEFORE UPDATE OR DELETE ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_audit_change();

ALTER TABLE public.company_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company admins manage company policies" ON public.company_policies;
CREATE POLICY "Company admins manage company policies"
ON public.company_policies
FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id((SELECT auth.uid()))
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
)
WITH CHECK (
  company_id = public.get_user_company_id((SELECT auth.uid()))
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Super admins read company policies" ON public.company_policies;
CREATE POLICY "Super admins read company policies"
ON public.company_policies
FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Company admins read policy versions" ON public.company_policy_versions;
CREATE POLICY "Company admins read policy versions"
ON public.company_policy_versions
FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id((SELECT auth.uid()))
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Super admins read company policy versions" ON public.company_policy_versions;
CREATE POLICY "Super admins read company policy versions"
ON public.company_policy_versions
FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Company users read consent records" ON public.consent_records;
CREATE POLICY "Company users read consent records"
ON public.consent_records
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id((SELECT auth.uid())));

DROP POLICY IF EXISTS "Super admins read consent records" ON public.consent_records;
CREATE POLICY "Super admins read consent records"
ON public.consent_records
FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE ON public.company_policies TO authenticated;
GRANT SELECT ON public.company_policy_versions TO authenticated;
GRANT SELECT ON public.consent_records TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.company_policy_versions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.consent_records FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.publish_company_policy(
  _policy_key text,
  _title text,
  _content_html text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _policy_id uuid;
  _version_id uuid;
  _next_version integer;
BEGIN
  _company_id := public.get_user_company_id((SELECT auth.uid()));

  IF _company_id IS NULL OR NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only company admins can publish company policies.';
  END IF;
  IF coalesce(trim(_policy_key), '') = '' OR _policy_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid policy key.';
  END IF;
  IF coalesce(trim(_title), '') = '' THEN
    RAISE EXCEPTION 'Policy title is required.';
  END IF;
  IF coalesce(trim(_content_html), '') = '' THEN
    RAISE EXCEPTION 'Policy content is required.';
  END IF;

  INSERT INTO public.company_policies (
    company_id, key, draft_title, draft_content_html, created_by, updated_by
  ) VALUES (
    _company_id, _policy_key, trim(_title), _content_html, (SELECT auth.uid()), (SELECT auth.uid())
  )
  ON CONFLICT (company_id, key) DO UPDATE
    SET draft_title = EXCLUDED.draft_title,
        draft_content_html = EXCLUDED.draft_content_html,
        updated_by = (SELECT auth.uid()),
        updated_at = now()
  RETURNING id INTO _policy_id;

  SELECT coalesce(max(version_number), 0) + 1
    INTO _next_version
  FROM public.company_policy_versions
  WHERE policy_id = _policy_id;

  INSERT INTO public.company_policy_versions (
    company_id, policy_id, key, version_number, title, content_html, published_by
  ) VALUES (
    _company_id, _policy_id, _policy_key, _next_version, trim(_title), _content_html, (SELECT auth.uid())
  )
  RETURNING id INTO _version_id;

  UPDATE public.company_policies
  SET published_version_id = _version_id,
      draft_title = trim(_title),
      draft_content_html = _content_html,
      updated_by = (SELECT auth.uid()),
      updated_at = now()
  WHERE id = _policy_id;

  RETURN _version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_company_policy(
  _company_slug text,
  _policy_key text DEFAULT 'candidate_privacy_notice'
) RETURNS TABLE (
  company_id uuid,
  company_name text,
  company_slug text,
  policy_key text,
  title text,
  content_html text,
  version_id uuid,
  version_number integer,
  published_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.slug,
    v.key,
    v.title,
    v.content_html,
    v.id,
    v.version_number,
    v.published_at
  FROM public.companies c
  JOIN public.company_policies p
    ON p.company_id = c.id
   AND p.key = _policy_key
  JOIN public.company_policy_versions v
    ON v.id = p.published_version_id
  WHERE c.slug = _company_slug
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_consent_policy_context(
  _company_id uuid,
  _policy_key text DEFAULT 'candidate_privacy_notice'
) RETURNS TABLE (
  company_id uuid,
  company_name text,
  company_slug text,
  platform_policy_key text,
  platform_policy_title text,
  platform_policy_version_id uuid,
  platform_policy_updated_at timestamptz,
  company_policy_key text,
  company_policy_title text,
  company_policy_version_id uuid,
  company_policy_published_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH platform AS (
    SELECT pv.id, pv.key, pv.title, pv.updated_at
    FROM public.platform_policy_versions pv
    WHERE pv.key = 'data_protection'
    ORDER BY pv.updated_at DESC
    LIMIT 1
  ),
  company_policy AS (
    SELECT v.id, v.key, v.title, v.published_at
    FROM public.company_policies p
    JOIN public.company_policy_versions v ON v.id = p.published_version_id
    WHERE p.company_id = _company_id
      AND p.key = _policy_key
    LIMIT 1
  )
  SELECT
    c.id,
    c.name,
    c.slug,
    platform.key,
    platform.title,
    platform.id,
    platform.updated_at,
    company_policy.key,
    company_policy.title,
    company_policy.id,
    company_policy.published_at
  FROM public.companies c
  LEFT JOIN platform ON true
  LEFT JOIN company_policy ON true
  WHERE c.id = _company_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.record_consent(
  _company_id uuid,
  _consent_key text,
  _source_flow text,
  _consent_text text,
  _candidate_id uuid DEFAULT NULL,
  _application_id uuid DEFAULT NULL,
  _submission_id uuid DEFAULT NULL,
  _screening_submission_id uuid DEFAULT NULL,
  _assignment_id uuid DEFAULT NULL,
  _interview_feedback_id uuid DEFAULT NULL,
  _page_path text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _platform record;
  _company_policy record;
  _consent_id uuid;
BEGIN
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for consent records.';
  END IF;
  IF coalesce(trim(_consent_key), '') = '' OR _consent_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid consent key.';
  END IF;
  IF coalesce(trim(_source_flow), '') = '' OR _source_flow !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid consent source.';
  END IF;
  IF coalesce(trim(_consent_text), '') = '' THEN
    RAISE EXCEPTION 'Consent text is required.';
  END IF;

  SELECT pv.id, pv.key, pv.title, pv.updated_at
    INTO _platform
  FROM public.platform_policy_versions pv
  WHERE pv.key = 'data_protection'
  ORDER BY pv.updated_at DESC
  LIMIT 1;

  SELECT v.id, v.key, v.title, v.published_at
    INTO _company_policy
  FROM public.company_policies p
  JOIN public.company_policy_versions v ON v.id = p.published_version_id
  WHERE p.company_id = _company_id
    AND p.key = 'candidate_privacy_notice'
  LIMIT 1;

  INSERT INTO public.consent_records (
    company_id,
    candidate_id,
    application_id,
    submission_id,
    screening_submission_id,
    assignment_id,
    interview_feedback_id,
    consent_key,
    source_flow,
    consent_text,
    platform_policy_key,
    platform_policy_version_id,
    platform_policy_title,
    platform_policy_updated_at,
    company_policy_key,
    company_policy_version_id,
    company_policy_title,
    company_policy_published_at,
    page_path,
    metadata
  ) VALUES (
    _company_id,
    _candidate_id,
    _application_id,
    _submission_id,
    _screening_submission_id,
    _assignment_id,
    _interview_feedback_id,
    _consent_key,
    _source_flow,
    trim(_consent_text),
    _platform.key,
    _platform.id,
    _platform.title,
    _platform.updated_at,
    _company_policy.key,
    _company_policy.id,
    _company_policy.title,
    _company_policy.published_at,
    nullif(trim(coalesce(_page_path, '')), ''),
    coalesce(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO _consent_id;

  RETURN _consent_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.consent_payload_accepted(_consents jsonb, _key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce((_consents -> _key ->> 'accepted')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.consent_payload_text(_consents jsonb, _key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(trim(coalesce(_consents -> _key ->> 'consent_text', '')), '');
$$;

CREATE OR REPLACE FUNCTION public.consent_payload_page_path(_consents jsonb, _key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(trim(coalesce(_consents -> _key ->> 'page_path', '')), '');
$$;

REVOKE ALL ON FUNCTION public.publish_company_policy(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_company_policy(text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_company_policy(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_company_policy(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_consent_policy_context(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_consent_policy_context(uuid, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.record_consent(uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_consent(uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.consent_payload_accepted(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consent_payload_text(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consent_payload_page_path(jsonb, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_public_job_application(
  _job_id uuid,
  _candidate_id uuid,
  _candidate jsonb,
  _resume jsonb,
  _additional_documents jsonb DEFAULT '[]'::jsonb,
  _screening_version_id uuid DEFAULT NULL,
  _screening_answers jsonb DEFAULT '{}'::jsonb,
  _consents jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(candidate_id uuid, application_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _resolved_candidate_id uuid;
  _application_id uuid;
  _active_version_id uuid;
  _question_count integer := 0;
  _normalized_email text;
  _review_needed_count integer := 0;
  _score numeric(5,2) := 0;
  _document jsonb;
  _consent_text text;
  _page_path text;
BEGIN
  IF NOT public.consent_payload_accepted(_consents, 'data_protection') THEN
    RAISE EXCEPTION 'You must agree to the data protection policies to continue.';
  END IF;
  _consent_text := public.consent_payload_text(_consents, 'data_protection');
  IF _consent_text IS NULL THEN
    RAISE EXCEPTION 'Consent text is required.';
  END IF;
  _page_path := public.consent_payload_page_path(_consents, 'data_protection');

  SELECT j.company_id INTO _company_id
  FROM public.jobs j
  JOIN public.companies c ON c.id = j.company_id
  WHERE j.id = _job_id
    AND j.status = 'open'::public.job_status
    AND j.expires_at > now()
    AND c.status = 'active';

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'This job is no longer accepting applications.';
  END IF;

  _normalized_email := lower(trim(coalesce(_candidate->>'email', '')));

  IF coalesce(trim(_candidate->>'name'), '') = '' THEN RAISE EXCEPTION 'Full name is required.'; END IF;
  IF _normalized_email = '' OR _normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Enter a valid email.'; END IF;
  IF coalesce(trim(_candidate->>'phone'), '') = '' THEN RAISE EXCEPTION 'Phone number is required.'; END IF;
  IF coalesce(trim(_candidate->>'country'), '') = '' THEN RAISE EXCEPTION 'Country is required.'; END IF;
  IF coalesce(trim(_candidate->>'streetAddress'), '') = '' THEN RAISE EXCEPTION 'Street address is required.'; END IF;
  IF coalesce(trim(_candidate->>'parishState'), '') = '' THEN RAISE EXCEPTION 'Parish/State is required.'; END IF;
  IF coalesce(trim(_candidate->>'educationLevel'), '') = '' THEN RAISE EXCEPTION 'Education level is required.'; END IF;
  IF coalesce(trim(_resume->>'key'), '') = '' THEN RAISE EXCEPTION 'Resume is required.'; END IF;

  IF coalesce(trim(_candidate->>'linkedinUrl'), '') <> ''
     AND trim(_candidate->>'linkedinUrl') !~* '^https?://(www\.)?linkedin\.com/.+' THEN
    RAISE EXCEPTION 'Enter a valid LinkedIn URL.';
  END IF;

  SELECT c.id INTO _resolved_candidate_id
  FROM public.candidates c
  WHERE c.company_id = _company_id
    AND lower(c.email) = _normalized_email
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF _resolved_candidate_id IS NULL THEN
    _resolved_candidate_id := coalesce(_candidate_id, gen_random_uuid());
    INSERT INTO public.candidates (
      id, company_id, name, email, phone, linkedin_url, country, street_address, parish_state,
      education_level, resume_url, resume_bucket, resume_object_key, resume_filename,
      resume_content_type, resume_size_bytes
    ) VALUES (
      _resolved_candidate_id, _company_id, trim(_candidate->>'name'), _normalized_email,
      trim(_candidate->>'phone'), nullif(trim(coalesce(_candidate->>'linkedinUrl', '')), ''),
      trim(_candidate->>'country'), trim(_candidate->>'streetAddress'), trim(_candidate->>'parishState'),
      trim(_candidate->>'educationLevel'), _resume->>'key', _resume->>'bucket', _resume->>'key',
      _resume->>'filename', _resume->>'contentType', coalesce((_resume->>'size')::bigint, 0)
    );
  ELSE
    UPDATE public.candidates
    SET name = trim(_candidate->>'name'),
        phone = trim(_candidate->>'phone'),
        linkedin_url = nullif(trim(coalesce(_candidate->>'linkedinUrl', '')), ''),
        country = trim(_candidate->>'country'),
        street_address = trim(_candidate->>'streetAddress'),
        parish_state = trim(_candidate->>'parishState'),
        education_level = trim(_candidate->>'educationLevel'),
        resume_url = _resume->>'key',
        resume_bucket = _resume->>'bucket',
        resume_object_key = _resume->>'key',
        resume_filename = _resume->>'filename',
        resume_content_type = _resume->>'contentType',
        resume_size_bytes = coalesce((_resume->>'size')::bigint, 0)
    WHERE id = _resolved_candidate_id
      AND company_id = _company_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.job_id = _job_id
      AND a.candidate_id = _resolved_candidate_id
  ) THEN
    RAISE EXCEPTION 'You have already submitted an application for this job.';
  END IF;

  SELECT v.id, count(q.id)::integer
    INTO _active_version_id, _question_count
  FROM public.job_screening_versions v
  LEFT JOIN public.job_screening_questions q ON q.version_id = v.id
  WHERE v.job_id = _job_id
    AND v.status IN ('published', 'locked')
    AND (_screening_version_id IS NULL OR v.id = _screening_version_id)
  GROUP BY v.id, v.version
  ORDER BY v.version DESC
  LIMIT 1;

  IF _screening_version_id IS NOT NULL AND _active_version_id IS NULL THEN
    RAISE EXCEPTION 'The screening questions for this job are no longer available. Please refresh and try again.';
  END IF;

  IF _active_version_id IS NOT NULL AND _question_count > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.job_screening_questions q
      WHERE q.version_id = _active_version_id
        AND q.required
        AND (
          NOT (_screening_answers ? q.id::text)
          OR _screening_answers -> q.id::text = 'null'::jsonb
          OR (_screening_answers ->> q.id::text) = ''
          OR (_screening_answers -> q.id::text = '[]'::jsonb)
        )
    ) THEN
      RAISE EXCEPTION 'Please complete all required screening questions.';
    END IF;
  END IF;

  INSERT INTO public.applications (company_id, job_id, candidate_id, stage)
  VALUES (_company_id, _job_id, _resolved_candidate_id, 'applied'::public.application_stage)
  RETURNING id INTO _application_id;

  PERFORM public.record_consent(
    _company_id,
    'data_protection',
    'public_job_application',
    _consent_text,
    _resolved_candidate_id,
    _application_id,
    NULL,
    NULL,
    NULL,
    NULL,
    _page_path,
    jsonb_build_object('job_id', _job_id)
  );

  INSERT INTO public.candidate_files (
    company_id, candidate_id, job_id, category, bucket, file_key, file_name, file_type, file_size
  ) VALUES (
    _company_id, _resolved_candidate_id, _job_id, 'resume', _resume->>'bucket', _resume->>'key',
    _resume->>'filename', _resume->>'contentType', coalesce((_resume->>'size')::bigint, 0)
  );

  IF jsonb_typeof(_additional_documents) = 'array' THEN
    FOR _document IN SELECT value FROM jsonb_array_elements(_additional_documents)
    LOOP
      IF coalesce(trim(_document->>'key'), '') <> '' THEN
        INSERT INTO public.candidate_files (
          company_id, candidate_id, job_id, category, bucket, file_key, file_name, file_type, file_size
        ) VALUES (
          _company_id, _resolved_candidate_id, _job_id, 'document', _document->>'bucket', _document->>'key',
          _document->>'filename', _document->>'contentType', coalesce((_document->>'size')::bigint, 0)
        );
      END IF;
    END LOOP;
  END IF;

  IF _active_version_id IS NOT NULL AND _question_count > 0 THEN
    CREATE TEMP TABLE IF NOT EXISTS pg_temp._screening_answer_scores (
      question_id uuid,
      answer jsonb,
      earned_percent numeric(5,2)
    ) ON COMMIT DROP;

    DELETE FROM pg_temp._screening_answer_scores;

    INSERT INTO pg_temp._screening_answer_scores(question_id, answer, earned_percent)
    SELECT
      q.id,
      coalesce(_screening_answers -> q.id::text, 'null'::jsonb),
      CASE
        WHEN q.type IN ('short_text', 'long_text') THEN NULL::numeric
        WHEN q.type = 'multi_select' THEN (
          SELECT least(100, coalesce(sum(c.credit_percent), 0))::numeric(5,2)
          FROM public.job_screening_choices c
          WHERE c.question_id = q.id
            AND jsonb_typeof(coalesce(_screening_answers -> q.id::text, '[]'::jsonb)) = 'array'
            AND c.id::text IN (
              SELECT jsonb_array_elements_text(coalesce(_screening_answers -> q.id::text, '[]'::jsonb))
            )
        )
        WHEN q.type IN ('yes_no', 'single_choice') THEN coalesce((
          SELECT c.credit_percent
          FROM public.job_screening_choices c
          WHERE c.question_id = q.id
            AND c.id::text = (_screening_answers ->> q.id::text)
          LIMIT 1
        ), 0)::numeric(5,2)
        WHEN q.type = 'number' THEN (
          CASE
            WHEN (_screening_answers ->> q.id::text) ~ '^-?\d+(\.\d+)?$'
              AND (NOT (q.settings ? 'min') OR nullif(q.settings->>'min', '') IS NULL OR (_screening_answers ->> q.id::text)::numeric >= (q.settings->>'min')::numeric)
              AND (NOT (q.settings ? 'max') OR nullif(q.settings->>'max', '') IS NULL OR (_screening_answers ->> q.id::text)::numeric <= (q.settings->>'max')::numeric)
            THEN 100::numeric(5,2)
            ELSE 0::numeric(5,2)
          END
        )
        ELSE 0::numeric(5,2)
      END AS earned_percent
    FROM public.job_screening_questions q
    WHERE q.version_id = _active_version_id
    ORDER BY q.position;

    SELECT
      count(*) FILTER (WHERE earned_percent IS NULL)::integer,
      round(coalesce(avg(coalesce(earned_percent, 0)), 0), 2)::numeric(5,2)
    INTO _review_needed_count, _score
    FROM pg_temp._screening_answer_scores;

    INSERT INTO public.job_screening_responses (
      company_id, application_id, version_id, status, score, review_needed_count, finalized_at
    ) VALUES (
      _company_id, _application_id, _active_version_id,
      CASE WHEN _review_needed_count > 0 THEN 'provisional'::public.screening_response_status ELSE 'final'::public.screening_response_status END,
      _score, _review_needed_count,
      CASE WHEN _review_needed_count > 0 THEN NULL ELSE now() END
    );

    INSERT INTO public.job_screening_answers (response_id, question_id, answer, earned_percent)
    SELECT r.id, s.question_id, s.answer, s.earned_percent
    FROM pg_temp._screening_answer_scores s
    CROSS JOIN public.job_screening_responses r
    WHERE r.application_id = _application_id;
  END IF;

  candidate_id := _resolved_candidate_id;
  application_id := _application_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb, jsonb) TO anon;

CREATE OR REPLACE FUNCTION public.submit_public_lead_form(
  _public_id text,
  _submission_id uuid,
  _answers jsonb,
  _confirmation_answers jsonb DEFAULT '{}'::jsonb,
  _upload_rows jsonb DEFAULT '[]'::jsonb,
  _consents jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  form_row record;
  field jsonb;
  field_id text;
  field_type text;
  field_value jsonb;
  field_text text;
  validation jsonb;
  upload_settings jsonb;
  min_length integer;
  max_length integer;
  mask_preset text;
  mask_pattern text;
  mask_regex text;
  requires_confirmation boolean;
  upload_row jsonb;
  upload_field jsonb;
  upload_size bigint;
  upload_max_mb numeric;
  allowed_categories text[];
  allowed_types text[];
  category text;
  _consent_text text;
  _page_path text;
BEGIN
  IF NOT public.consent_payload_accepted(_consents, 'data_protection') THEN
    RAISE EXCEPTION 'You must agree to the data protection policies to continue.';
  END IF;
  _consent_text := public.consent_payload_text(_consents, 'data_protection');
  IF _consent_text IS NULL THEN
    RAISE EXCEPTION 'Consent text is required.';
  END IF;
  _page_path := public.consent_payload_page_path(_consents, 'data_protection');

  SELECT lf.id, lf.company_id, lf.schema
  INTO form_row
  FROM public.lead_forms lf
  WHERE lf.public_id = _public_id
    AND lf.status = 'active'
    AND lf.deleted_at IS NULL
  LIMIT 1;

  IF form_row.id IS NULL THEN
    RAISE EXCEPTION 'Form unavailable';
  END IF;

  FOR field IN SELECT value FROM jsonb_array_elements(COALESCE(form_row.schema->'fields', '[]'::jsonb))
  LOOP
    field_id := field->>'id';
    field_type := field->>'type';
    IF field_id IS NULL OR field_type = 'section' THEN
      CONTINUE;
    END IF;

    field_value := _answers->field_id;
    IF COALESCE((field->>'required')::boolean, false)
      AND (
        field_value IS NULL
        OR field_value = 'null'::jsonb
        OR field_value = '""'::jsonb
        OR field_value = 'false'::jsonb
        OR field_value = '[]'::jsonb
      )
    THEN
      RAISE EXCEPTION 'Required field missing: %', field_id;
    END IF;

    IF field_value IS NULL OR field_value = 'null'::jsonb THEN
      CONTINUE;
    END IF;

    field_text := CASE WHEN jsonb_typeof(field_value) = 'string' THEN field_value #>> '{}' ELSE NULL END;
    validation := COALESCE(field->'validation', '{}'::jsonb);

    IF field_type = 'email' AND field_text IS NOT NULL AND field_text !~ '^\S+@\S+\.\S+$' THEN
      RAISE EXCEPTION 'Invalid email field: %', field_id;
    END IF;
    IF field_type = 'url' AND field_text IS NOT NULL AND field_text !~* '^https?://.+' THEN
      RAISE EXCEPTION 'Invalid URL field: %', field_id;
    END IF;

    min_length := NULLIF(validation->>'minLength', '')::integer;
    max_length := NULLIF(validation->>'maxLength', '')::integer;
    IF field_text IS NOT NULL AND min_length IS NOT NULL AND char_length(trim(field_text)) < min_length THEN
      RAISE EXCEPTION 'Field is shorter than allowed: %', field_id;
    END IF;
    IF field_text IS NOT NULL AND max_length IS NOT NULL AND char_length(trim(field_text)) > max_length THEN
      RAISE EXCEPTION 'Field is longer than allowed: %', field_id;
    END IF;

    mask_preset := COALESCE(validation->>'maskPreset', 'none');
    mask_pattern := CASE mask_preset
      WHEN 'phone' THEN '(999) 999-9999'
      WHEN 'zip' THEN '99999'
      WHEN 'ssn' THEN '999-99-9999'
      WHEN 'date' THEN '99/99/9999'
      WHEN 'custom' THEN COALESCE(validation->>'customMask', '')
      ELSE ''
    END;
    mask_regex := CASE mask_preset
      WHEN 'phone' THEN '^\([0-9]{3}\) [0-9]{3}-[0-9]{4}$'
      WHEN 'zip' THEN '^[0-9]{5}$'
      WHEN 'ssn' THEN '^[0-9]{3}-[0-9]{2}-[0-9]{4}$'
      WHEN 'date' THEN '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
      ELSE ''
    END;
    IF field_text IS NOT NULL AND mask_pattern <> '' AND char_length(field_text) <> char_length(mask_pattern) THEN
      RAISE EXCEPTION 'Field does not match mask length: %', field_id;
    END IF;
    IF field_text IS NOT NULL AND mask_regex <> '' AND field_text !~ mask_regex THEN
      RAISE EXCEPTION 'Field does not match mask pattern: %', field_id;
    END IF;

    requires_confirmation := COALESCE((validation->>'requireConfirmation')::boolean, false);
    IF requires_confirmation
      AND field_type IN ('text', 'email', 'phone', 'url')
      AND field_text IS DISTINCT FROM (_confirmation_answers->>field_id)
    THEN
      RAISE EXCEPTION 'Confirmation does not match: %', field_id;
    END IF;
  END LOOP;

  INSERT INTO public.lead_form_submissions (
    id, form_id, company_id, answers, schema_snapshot, status
  )
  VALUES (
    _submission_id, form_row.id, form_row.company_id, _answers, form_row.schema, 'new'
  );

  PERFORM public.record_consent(
    form_row.company_id,
    'data_protection',
    'public_lead_form',
    _consent_text,
    NULL,
    NULL,
    _submission_id,
    NULL,
    NULL,
    NULL,
    _page_path,
    jsonb_build_object('form_id', form_row.id)
  );

  FOR upload_row IN SELECT value FROM jsonb_array_elements(COALESCE(_upload_rows, '[]'::jsonb))
  LOOP
    SELECT value
    INTO upload_field
    FROM jsonb_array_elements(COALESCE(form_row.schema->'fields', '[]'::jsonb))
    WHERE value->>'id' = upload_row->>'field_id'
      AND value->>'type' = 'file'
    LIMIT 1;

    IF upload_field IS NULL THEN
      RAISE EXCEPTION 'Invalid upload field: %', upload_row->>'field_id';
    END IF;

    upload_settings := COALESCE(upload_field->'upload', '{}'::jsonb);
    upload_max_mb := COALESCE(NULLIF(upload_settings->>'maxSizeMb', '')::numeric, 10);
    upload_size := COALESCE(NULLIF(upload_row->>'file_size', '')::bigint, 0);
    IF upload_size <= 0 OR upload_size > (upload_max_mb * 1048576) THEN
      RAISE EXCEPTION 'Upload size is not allowed: %', upload_row->>'field_id';
    END IF;

    SELECT array_agg(value)
    INTO allowed_categories
    FROM jsonb_array_elements_text(COALESCE(upload_settings->'allowedCategories', '["documents","images"]'::jsonb));

    allowed_types := ARRAY[]::text[];
    FOREACH category IN ARRAY COALESCE(allowed_categories, ARRAY['documents', 'images'])
    LOOP
      IF category = 'documents' THEN
        allowed_types := allowed_types || ARRAY[
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
      ELSIF category = 'images' THEN
        allowed_types := allowed_types || ARRAY['image/png', 'image/jpeg', 'image/webp'];
      END IF;
    END LOOP;

    IF NOT (upload_row->>'file_type' = ANY(allowed_types)) THEN
      RAISE EXCEPTION 'Upload type is not allowed: %', upload_row->>'field_id';
    END IF;

    INSERT INTO public.lead_form_uploads (
      submission_id, form_id, company_id, field_id, bucket, object_key, file_name, file_type, file_size
    )
    VALUES (
      _submission_id, form_row.id, form_row.company_id, upload_row->>'field_id', upload_row->>'bucket',
      upload_row->>'object_key', upload_row->>'file_name', upload_row->>'file_type', upload_size
    );
  END LOOP;

  RETURN _submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_screening_response(
  _link_id text,
  _candidate_name text,
  _candidate_email text,
  _video jsonb,
  _attempt_number integer,
  _consents jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job record;
  _submission_id uuid;
  _email text;
  _privacy_text text;
  _recording_text text;
  _privacy_page text;
  _recording_page text;
BEGIN
  IF NOT public.consent_payload_accepted(_consents, 'data_protection') THEN
    RAISE EXCEPTION 'You must agree to the data protection policies to continue.';
  END IF;
  IF NOT public.consent_payload_accepted(_consents, 'video_recording') THEN
    RAISE EXCEPTION 'You must consent to video/audio recording to continue.';
  END IF;

  _privacy_text := public.consent_payload_text(_consents, 'data_protection');
  _recording_text := public.consent_payload_text(_consents, 'video_recording');
  _privacy_page := public.consent_payload_page_path(_consents, 'data_protection');
  _recording_page := public.consent_payload_page_path(_consents, 'video_recording');
  IF _privacy_text IS NULL OR _recording_text IS NULL THEN
    RAISE EXCEPTION 'Consent text is required.';
  END IF;

  SELECT id, job_id, company_id
    INTO _job
  FROM public.screening_jobs
  WHERE unique_link_id = _link_id
    AND expires_at > now()
  LIMIT 1;

  IF _job.id IS NULL THEN
    RAISE EXCEPTION 'This screening link is invalid or has expired.';
  END IF;
  IF coalesce(trim(_candidate_name), '') = '' THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;
  _email := lower(trim(coalesce(_candidate_email, '')));
  IF _email = '' OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email.';
  END IF;
  IF coalesce(trim(_video->>'key'), '') = '' THEN
    RAISE EXCEPTION 'Video upload is required.';
  END IF;

  INSERT INTO public.screening_submissions (
    screening_job_id,
    company_id,
    candidate_name,
    candidate_email,
    video_url,
    video_bucket,
    video_object_key,
    video_filename,
    video_content_type,
    video_size_bytes,
    privacy_consent,
    attempt_number,
    upload_status
  ) VALUES (
    _job.id,
    _job.company_id,
    trim(_candidate_name),
    _email,
    _video->>'key',
    _video->>'bucket',
    _video->>'key',
    _video->>'filename',
    _video->>'contentType',
    coalesce((_video->>'size')::bigint, 0),
    true,
    greatest(1, coalesce(_attempt_number, 1)),
    'uploaded'
  )
  RETURNING id INTO _submission_id;

  PERFORM public.record_consent(
    _job.company_id, 'data_protection', 'public_screening', _privacy_text,
    NULL, NULL, NULL, _submission_id, NULL, NULL, _privacy_page,
    jsonb_build_object('screening_job_id', _job.id, 'job_id', _job.job_id)
  );
  PERFORM public.record_consent(
    _job.company_id, 'video_recording', 'public_screening', _recording_text,
    NULL, NULL, NULL, _submission_id, NULL, NULL, _recording_page,
    jsonb_build_object('screening_job_id', _job.id, 'job_id', _job.job_id)
  );

  RETURN _submission_id;
END;
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
  _consent_text text;
  _page_path text;
BEGIN
  IF NOT public.consent_payload_accepted(_consents, 'guest_feedback') THEN
    RAISE EXCEPTION 'You must agree to the data protection policies to continue.';
  END IF;
  _consent_text := public.consent_payload_text(_consents, 'guest_feedback');
  IF _consent_text IS NULL THEN
    RAISE EXCEPTION 'Consent text is required.';
  END IF;
  _page_path := public.consent_payload_page_path(_consents, 'guest_feedback');

  SELECT fl.id, fl.company_id, fl.candidate_id, fl.job_id, fl.application_id, fl.expires_at, j.hiring_manager
    INTO _link
  FROM public.feedback_links fl
  LEFT JOIN public.jobs j ON j.id = fl.job_id
  WHERE fl.token = _token
    AND fl.expires_at > now()
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

  PERFORM public.record_consent(
    _link.company_id,
    'guest_feedback',
    'public_feedback',
    _consent_text,
    _link.candidate_id,
    _link.application_id,
    NULL,
    NULL,
    NULL,
    _feedback_id,
    _page_path,
    jsonb_build_object('feedback_link_id', _link.id, 'job_id', _link.job_id)
  );

  RETURN _feedback_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_lead_form(text, uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_lead_form(text, uuid, jsonb, jsonb, jsonb, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_public_screening_response(text, text, text, jsonb, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_screening_response(text, text, text, jsonb, integer, jsonb) TO anon;
REVOKE ALL ON FUNCTION public.submit_public_feedback(text, text, text, jsonb, uuid, jsonb, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_feedback(text, text, text, jsonb, uuid, jsonb, numeric, jsonb) TO anon;
