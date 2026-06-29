CREATE EXTENSION IF NOT EXISTS pgmq;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pgmq.list_queues()
    WHERE queue_name = 'application_emails'
  ) THEN
    PERFORM pgmq.create('application_emails');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_application_received_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pgmq
AS $$
BEGIN
  PERFORM pgmq.send(
    'application_emails',
    jsonb_build_object(
      'mode', 'application_received',
      'application_id', NEW.id::text
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_application_received_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enqueue_application_received_email ON public.applications;

CREATE TRIGGER enqueue_application_received_email
  AFTER INSERT ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_application_received_email();

CREATE OR REPLACE FUNCTION public.read_application_email_queue(
  p_visibility_timeout integer DEFAULT 180,
  p_batch_size integer DEFAULT 20
)
RETURNS TABLE (
  msg_id bigint,
  read_ct bigint,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pgmq
AS $$
  SELECT msg_id, read_ct, enqueued_at, vt, message
  FROM pgmq.read(
    'application_emails',
    greatest(30, least(600, p_visibility_timeout)),
    greatest(1, least(100, p_batch_size))
  );
$$;

REVOKE ALL ON FUNCTION public.read_application_email_queue(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_application_email_queue(integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_application_email_queue_message(p_msg_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pgmq
AS $$
  SELECT pgmq.delete('application_emails', p_msg_id);
$$;

REVOKE ALL ON FUNCTION public.delete_application_email_queue_message(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_application_email_queue_message(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.archive_application_email_queue_message(p_msg_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pgmq
AS $$
  SELECT pgmq.archive('application_emails', p_msg_id);
$$;

REVOKE ALL ON FUNCTION public.archive_application_email_queue_message(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_application_email_queue_message(bigint) TO service_role;
