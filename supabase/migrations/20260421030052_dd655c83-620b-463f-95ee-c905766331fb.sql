DROP POLICY IF EXISTS "Public can create candidates" ON public.candidates;
DROP POLICY IF EXISTS "Public can create candidates for existing companies" ON public.candidates;
DROP POLICY IF EXISTS "Public can create applications" ON public.applications;
DROP POLICY IF EXISTS "Public can create applications for open jobs" ON public.applications;
DROP POLICY IF EXISTS "Anon can insert candidate files" ON public.candidate_files;
DROP POLICY IF EXISTS "Public can create candidate resume files" ON public.candidate_files;

CREATE POLICY "Public can create candidates for existing companies"
ON public.candidates
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = candidates.company_id
  )
);

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
  )
);

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
    )
  )
);