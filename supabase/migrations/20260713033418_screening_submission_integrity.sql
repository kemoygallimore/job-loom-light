CREATE UNIQUE INDEX IF NOT EXISTS applications_one_candidate_per_job_idx
  ON public.applications(job_id, candidate_id);

DROP POLICY IF EXISTS "Public reads active screening versions" ON public.job_screening_versions;
CREATE POLICY "Public reads active screening versions" ON public.job_screening_versions
  FOR SELECT TO anon
  USING (
    status IN ('published', 'locked')
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_id
        AND j.status = 'open'::public.job_status
        AND j.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Public reads active screening questions" ON public.job_screening_questions;
CREATE POLICY "Public reads active screening questions" ON public.job_screening_questions
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_screening_versions v
      JOIN public.jobs j ON j.id = v.job_id
      WHERE v.id = version_id
        AND v.status IN ('published', 'locked')
        AND j.status = 'open'::public.job_status
        AND j.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Public reads active screening choices" ON public.job_screening_choices;
CREATE POLICY "Public reads active screening choices" ON public.job_screening_choices
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_screening_questions q
      JOIN public.job_screening_versions v ON v.id = q.version_id
      JOIN public.jobs j ON j.id = v.job_id
      WHERE q.id = question_id
        AND v.status IN ('published', 'locked')
        AND j.status = 'open'::public.job_status
        AND j.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Applicants submit screening responses" ON public.job_screening_responses;
CREATE POLICY "Applicants submit screening responses" ON public.job_screening_responses
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.job_screening_versions v ON v.job_id = a.job_id
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = public.job_screening_responses.application_id
        AND a.company_id = public.job_screening_responses.company_id
        AND v.id = public.job_screening_responses.version_id
        AND v.status IN ('published', 'locked')
        AND j.status = 'open'::public.job_status
        AND j.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Allow anon to create public applications" ON public.applications;
DROP POLICY IF EXISTS "Public can create applications for open jobs" ON public.applications;
DROP POLICY IF EXISTS "Anon can lookup applications" ON public.applications;
DROP POLICY IF EXISTS "Anon can lookup candidates" ON public.candidates;
DROP POLICY IF EXISTS "Anon can attach resume to new candidate" ON public.candidates;
DROP POLICY IF EXISTS "Public can create candidates for companies with open jobs" ON public.candidates;
DROP POLICY IF EXISTS "Enable insert for to candidate profile" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can insert candidate profiles" ON public.candidates;
CREATE POLICY "Authenticated users can insert candidate profiles" ON public.candidates
  FOR INSERT TO authenticated
  WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update candidates in own company" ON public.candidates;
CREATE POLICY "Users can update candidates in own company" ON public.candidates
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id((SELECT auth.uid())))
  WITH CHECK (company_id = public.get_user_company_id((SELECT auth.uid())));
DROP POLICY IF EXISTS "Public can create candidate resume files" ON public.candidate_files;

CREATE OR REPLACE FUNCTION public.submit_public_job_application(
  _job_id uuid,
  _candidate_id uuid,
  _candidate jsonb,
  _resume jsonb,
  _additional_documents jsonb DEFAULT '[]'::jsonb,
  _screening_version_id uuid DEFAULT NULL,
  _screening_answers jsonb DEFAULT '{}'::jsonb
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
  _answer_value jsonb;
  _earned_percent numeric(5,2);
  _review_needed_count integer := 0;
  _score numeric(5,2) := 0;
  _document jsonb;
BEGIN
  SELECT j.company_id
    INTO _company_id
  FROM public.jobs j
  WHERE j.id = _job_id
    AND j.status = 'open'::public.job_status
    AND j.expires_at > now();

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'This job is no longer accepting applications.';
  END IF;

  _normalized_email := lower(trim(coalesce(_candidate->>'email', '')));

  IF coalesce(trim(_candidate->>'name'), '') = '' THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;
  IF _normalized_email = '' OR _normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email.';
  END IF;
  IF coalesce(trim(_candidate->>'phone'), '') = '' THEN
    RAISE EXCEPTION 'Phone number is required.';
  END IF;
  IF coalesce(trim(_candidate->>'country'), '') = '' THEN
    RAISE EXCEPTION 'Country is required.';
  END IF;
  IF coalesce(trim(_candidate->>'streetAddress'), '') = '' THEN
    RAISE EXCEPTION 'Street address is required.';
  END IF;
  IF coalesce(trim(_candidate->>'parishState'), '') = '' THEN
    RAISE EXCEPTION 'Parish/State is required.';
  END IF;
  IF coalesce(trim(_candidate->>'educationLevel'), '') = '' THEN
    RAISE EXCEPTION 'Education level is required.';
  END IF;
  IF coalesce(trim(_resume->>'key'), '') = '' THEN
    RAISE EXCEPTION 'Resume is required.';
  END IF;

  IF coalesce(trim(_candidate->>'linkedinUrl'), '') <> ''
     AND trim(_candidate->>'linkedinUrl') !~* '^https?://(www\.)?linkedin\.com/.+' THEN
    RAISE EXCEPTION 'Enter a valid LinkedIn URL.';
  END IF;

  SELECT c.id
    INTO _resolved_candidate_id
  FROM public.candidates c
  WHERE c.company_id = _company_id
    AND lower(c.email) = _normalized_email
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF _resolved_candidate_id IS NULL THEN
    _resolved_candidate_id := coalesce(_candidate_id, gen_random_uuid());

    INSERT INTO public.candidates (
      id,
      company_id,
      name,
      email,
      phone,
      linkedin_url,
      country,
      street_address,
      parish_state,
      education_level,
      resume_url,
      resume_bucket,
      resume_object_key,
      resume_filename,
      resume_content_type,
      resume_size_bytes
    ) VALUES (
      _resolved_candidate_id,
      _company_id,
      trim(_candidate->>'name'),
      _normalized_email,
      trim(_candidate->>'phone'),
      nullif(trim(coalesce(_candidate->>'linkedinUrl', '')), ''),
      trim(_candidate->>'country'),
      trim(_candidate->>'streetAddress'),
      trim(_candidate->>'parishState'),
      trim(_candidate->>'educationLevel'),
      _resume->>'key',
      _resume->>'bucket',
      _resume->>'key',
      _resume->>'filename',
      _resume->>'contentType',
      coalesce((_resume->>'size')::bigint, 0)
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
    SELECT 1
    FROM public.applications a
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

  INSERT INTO public.applications (
    company_id,
    job_id,
    candidate_id,
    stage
  ) VALUES (
    _company_id,
    _job_id,
    _resolved_candidate_id,
    'applied'::public.application_stage
  )
  RETURNING id INTO _application_id;

  INSERT INTO public.candidate_files (
    company_id,
    candidate_id,
    job_id,
    category,
    bucket,
    file_key,
    file_name,
    file_type,
    file_size
  ) VALUES (
    _company_id,
    _resolved_candidate_id,
    _job_id,
    'resume',
    _resume->>'bucket',
    _resume->>'key',
    _resume->>'filename',
    _resume->>'contentType',
    coalesce((_resume->>'size')::bigint, 0)
  );

  IF jsonb_typeof(_additional_documents) = 'array' THEN
    FOR _document IN SELECT value FROM jsonb_array_elements(_additional_documents)
    LOOP
      IF coalesce(trim(_document->>'key'), '') <> '' THEN
        INSERT INTO public.candidate_files (
          company_id,
          candidate_id,
          job_id,
          category,
          bucket,
          file_key,
          file_name,
          file_type,
          file_size
        ) VALUES (
          _company_id,
          _resolved_candidate_id,
          _job_id,
          'document',
          _document->>'bucket',
          _document->>'key',
          _document->>'filename',
          _document->>'contentType',
          coalesce((_document->>'size')::bigint, 0)
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
      company_id,
      application_id,
      version_id,
      status,
      score,
      review_needed_count,
      finalized_at
    ) VALUES (
      _company_id,
      _application_id,
      _active_version_id,
      CASE WHEN _review_needed_count > 0 THEN 'provisional'::public.screening_response_status ELSE 'final'::public.screening_response_status END,
      _score,
      _review_needed_count,
      CASE WHEN _review_needed_count > 0 THEN NULL ELSE now() END
    );

    INSERT INTO public.job_screening_answers (
      response_id,
      question_id,
      answer,
      earned_percent
    )
    SELECT
      r.id,
      s.question_id,
      s.answer,
      s.earned_percent
    FROM pg_temp._screening_answer_scores s
    CROSS JOIN public.job_screening_responses r
    WHERE r.application_id = _application_id;
  END IF;

  candidate_id := _resolved_candidate_id;
  application_id := _application_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb) TO anon;
