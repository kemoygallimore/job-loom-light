ALTER TABLE public.screening_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view screening jobs by link" ON public.screening_jobs;
DROP POLICY IF EXISTS "Public can view active screening jobs" ON public.screening_jobs;
DROP POLICY IF EXISTS "Public can create submissions" ON public.screening_submissions;
DROP POLICY IF EXISTS "public insert allowed" ON public.screening_submissions;
DROP POLICY IF EXISTS "Public can submit active screening responses" ON public.screening_submissions;

CREATE POLICY "Public can view active screening jobs"
ON public.screening_jobs
FOR SELECT
TO anon
USING (expires_at > now());

CREATE POLICY "Public can submit active screening responses"
ON public.screening_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  privacy_consent = true
  AND EXISTS (
    SELECT 1
    FROM public.screening_jobs sj
    WHERE sj.id = screening_job_id
      AND sj.company_id = company_id
      AND sj.expires_at > now()
  )
);