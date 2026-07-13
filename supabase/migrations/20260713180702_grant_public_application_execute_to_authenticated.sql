GRANT EXECUTE ON FUNCTION public.submit_public_job_application(
  uuid,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  jsonb,
  jsonb
) TO anon, authenticated;
