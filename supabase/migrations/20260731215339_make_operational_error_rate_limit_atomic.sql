CREATE OR REPLACE FUNCTION public.accept_operational_error_report(
  _occurred_at timestamptz,
  _company_id uuid,
  _user_id uuid,
  _actor_hash text,
  _source text,
  _method text,
  _http_status integer,
  _service_path text,
  _error_code text,
  _error_message text,
  _page_path text,
  _stack text,
  _since timestamptz,
  _limit integer
) RETURNS TABLE (id uuid, received_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF _limit NOT IN (5, 20) THEN
    RAISE EXCEPTION 'Invalid operational error report limit';
  END IF;

  -- Serialize acceptance per actor so concurrent requests cannot exceed the
  -- rolling limit between a separate count and insert.
  PERFORM pg_advisory_xact_lock(hashtextextended(_actor_hash, 0));

  IF (
    SELECT count(*)
    FROM public.operational_error_reports reports
    WHERE reports.actor_hash = _actor_hash
      AND reports.received_at >= _since
  ) >= _limit THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.operational_error_reports (
    occurred_at,
    company_id,
    user_id,
    actor_hash,
    source,
    method,
    http_status,
    service_path,
    error_code,
    error_message,
    page_path,
    stack,
    email_status
  ) VALUES (
    _occurred_at,
    _company_id,
    _user_id,
    _actor_hash,
    _source,
    _method,
    _http_status,
    _service_path,
    _error_code,
    _error_message,
    _page_path,
    _stack,
    'pending'
  )
  RETURNING operational_error_reports.id, operational_error_reports.received_at;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_operational_error_report(
  timestamptz, uuid, uuid, text, text, text, integer, text, text, text, text, text, timestamptz, integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_operational_error_report(
  timestamptz, uuid, uuid, text, text, text, integer, text, text, text, text, text, timestamptz, integer
) TO service_role;
