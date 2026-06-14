DROP POLICY IF EXISTS "Public can create candidate resume files" ON public.candidate_files;

CREATE POLICY "Public can create candidate application files"
ON public.candidate_files
FOR INSERT
TO anon
WITH CHECK (
  category IN ('resume', 'document')
  AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_files.candidate_id
      AND c.company_id = candidate_files.company_id
  )
  AND (
    job_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = candidate_files.job_id
        AND j.company_id = candidate_files.company_id
        AND j.status = 'open'
    )
  )
);