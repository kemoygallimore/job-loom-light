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
  -- Validate candidate belongs to company
  IF NOT EXISTS (
    SELECT 1 FROM public.candidates
    WHERE id = _candidate_id AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'Invalid candidate';
  END IF;

  -- Validate job belongs to company and is open (if provided)
  IF _job_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = _job_id AND company_id = _company_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Invalid job';
  END IF;

  INSERT INTO public.candidate_files (
    company_id, candidate_id, job_id, category,
    bucket, file_key, file_name, file_type, file_size
  ) VALUES (
    _company_id, _candidate_id, _job_id, 'resume',
    _bucket, _file_key, _file_name, _file_type, _file_size
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_resume_version(uuid, uuid, uuid, text, text, text, text, bigint) TO anon, authenticated;