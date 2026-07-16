
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
    AND j.status = 'open'
    AND c.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_company_for_job(uuid) TO anon, authenticated;
