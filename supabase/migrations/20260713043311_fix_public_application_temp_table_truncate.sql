DO $$
DECLARE
  _function_oid oid;
  _function_sql text;
BEGIN
  SELECT p.oid
  INTO _function_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'submit_public_job_application'
    AND oidvectortypes(p.proargtypes) = 'uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb';

  IF _function_oid IS NULL THEN
    RAISE EXCEPTION 'Expected function public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb) was not found';
  END IF;

  _function_sql := pg_get_functiondef(_function_oid);

  IF position('DELETE FROM pg_temp._screening_answer_scores;' IN _function_sql) = 0 THEN
    RAISE NOTICE 'submit_public_job_application already avoids the bare temp-table DELETE';
  ELSE
    EXECUTE replace(
      _function_sql,
      'DELETE FROM pg_temp._screening_answer_scores;',
      'TRUNCATE TABLE pg_temp._screening_answer_scores;'
    );
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb) TO anon;
