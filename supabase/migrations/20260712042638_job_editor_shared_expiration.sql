ALTER TABLE public.jobs
ADD COLUMN expires_at timestamptz;

WITH linked_screening AS (
  SELECT DISTINCT ON (sj.job_id)
    sj.job_id,
    sj.expires_at
  FROM public.screening_jobs sj
  WHERE sj.job_id IS NOT NULL
  ORDER BY sj.job_id, sj.created_at DESC
)
UPDATE public.jobs j
SET expires_at = COALESCE(ls.expires_at, now() + interval '30 days')
FROM linked_screening ls
WHERE j.id = ls.job_id
  AND j.expires_at IS NULL;

UPDATE public.jobs
SET expires_at = now() + interval '30 days'
WHERE expires_at IS NULL;

ALTER TABLE public.jobs
ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

ALTER TABLE public.jobs
ALTER COLUMN expires_at SET NOT NULL;

UPDATE public.screening_jobs sj
SET
  title = j.title,
  expires_at = j.expires_at
FROM public.jobs j
WHERE sj.job_id = j.id
  AND (
    sj.title IS DISTINCT FROM j.title
    OR sj.expires_at IS DISTINCT FROM j.expires_at
  );

DROP POLICY IF EXISTS "Public can view open jobs" ON public.jobs;
CREATE POLICY "Public can view open jobs"
ON public.jobs
FOR SELECT
TO anon
USING (
  status = 'open'::public.job_status
  AND expires_at > now()
);

DROP POLICY IF EXISTS "Public can create candidates for existing companies" ON public.candidates;
DROP POLICY IF EXISTS "Public can create candidates for companies with open jobs" ON public.candidates;
CREATE POLICY "Public can create candidates for companies with open jobs"
ON public.candidates
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.company_id = candidates.company_id
      AND j.status = 'open'::public.job_status
      AND j.expires_at > now()
  )
);

DROP POLICY IF EXISTS "Public can create applications for open jobs" ON public.applications;
CREATE POLICY "Public can create applications for open jobs"
ON public.applications
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.candidates c ON c.id = applications.candidate_id
    WHERE j.id = applications.job_id
      AND j.company_id = applications.company_id
      AND c.company_id = applications.company_id
      AND j.status = 'open'::public.job_status
      AND j.expires_at > now()
  )
);

DROP POLICY IF EXISTS "Public can create candidate resume files" ON public.candidate_files;
CREATE POLICY "Public can create candidate resume files"
ON public.candidate_files
FOR INSERT
TO anon
WITH CHECK (
  category = 'resume'
  AND EXISTS (
    SELECT 1
    FROM public.candidates c
    WHERE c.id = candidate_files.candidate_id
      AND c.company_id = candidate_files.company_id
  )
  AND (
    candidate_files.job_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = candidate_files.job_id
        AND j.company_id = candidate_files.company_id
        AND j.status = 'open'::public.job_status
        AND j.expires_at > now()
    )
  )
);

CREATE OR REPLACE FUNCTION public.get_public_company_by_slug(_slug text)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug
  FROM public.companies c
  WHERE c.slug = _slug
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.company_id = c.id
        AND j.status = 'open'::public.job_status
        AND j.expires_at > now()
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_company_by_slug(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_company_for_job(_job_id uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name
  FROM public.companies c
  JOIN public.jobs j ON j.company_id = c.id
  WHERE j.id = _job_id
    AND j.status = 'open'::public.job_status
    AND j.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_company_for_job(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.archive_resume_version(
  _candidate_id uuid,
  _company_id uuid,
  _job_id uuid,
  _bucket text,
  _file_key text,
  _file_name text,
  _file_type text,
  _file_size bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.candidates
    WHERE id = _candidate_id
      AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'Invalid candidate';
  END IF;

  IF _job_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE id = _job_id
      AND company_id = _company_id
      AND status = 'open'::public.job_status
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Invalid job';
  END IF;

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
    _candidate_id,
    _job_id,
    'resume',
    _bucket,
    _file_key,
    _file_name,
    _file_type,
    _file_size
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_resume_version(uuid, uuid, uuid, text, text, text, text, bigint) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view active screening jobs" ON public.screening_jobs;
CREATE POLICY "Public can view active screening jobs"
ON public.screening_jobs
FOR SELECT
TO anon
USING (
  expires_at > now()
  AND (
    job_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = screening_jobs.job_id
        AND j.status = 'open'::public.job_status
        AND j.expires_at > now()
    )
  )
);

DROP POLICY IF EXISTS "Public can submit active screening responses" ON public.screening_submissions;
CREATE POLICY "Public can submit active screening responses"
ON public.screening_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  privacy_consent = true
  AND EXISTS (
    SELECT 1
    FROM public.screening_jobs sj
    LEFT JOIN public.jobs j ON j.id = sj.job_id
    WHERE sj.id = screening_submissions.screening_job_id
      AND sj.company_id = screening_submissions.company_id
      AND sj.expires_at > now()
      AND (
        sj.job_id IS NULL
        OR (
          j.status = 'open'::public.job_status
          AND j.expires_at > now()
        )
      )
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
        AND v.status = 'published'
        AND j.status = 'open'::public.job_status
        AND j.expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Public reads active screening versions" ON public.job_screening_versions;
CREATE POLICY "Public reads active screening versions" ON public.job_screening_versions
  FOR SELECT TO anon
  USING (
    status = 'published'
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
        AND v.status = 'published'
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
        AND v.status = 'published'
        AND j.status = 'open'::public.job_status
        AND j.expires_at > now()
    )
  );
