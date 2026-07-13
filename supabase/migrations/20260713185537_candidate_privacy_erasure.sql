-- Controlled candidate privacy erasure.
-- Normal updates/deletes to consent records and published policy versions stay blocked.

CREATE OR REPLACE FUNCTION public.reject_immutable_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.privacy_erasure', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Published policy versions and consent records are immutable.';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_candidate_for_privacy(_candidate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := (SELECT auth.uid());
  _actor_company_id uuid;
  _candidate_company_id uuid;
  _candidate_email text;
  _is_super_admin boolean;
  _application_count integer := 0;
  _assignment_count integer := 0;
  _lead_submission_count integer := 0;
  _feedback_count integer := 0;
  _screening_submission_count integer := 0;
  _consent_count integer := 0;
  _email_log_count integer := 0;
  _queued_email_count integer := 0;
  _archived_queued_email_count integer := 0;
  _feedback_link_count integer := 0;
  _tag_assignment_count integer := 0;
  _candidate_count integer := 0;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  _actor_company_id := public.get_user_company_id(_actor);
  _is_super_admin := public.has_role(_actor, 'super_admin'::public.app_role);

  IF NOT _is_super_admin AND (
    _actor_company_id IS NULL
    OR NOT public.has_role(_actor, 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only company admins can permanently delete candidates.';
  END IF;

  SELECT c.company_id, lower(trim(coalesce(c.email, '')))
    INTO _candidate_company_id, _candidate_email
  FROM public.candidates c
  WHERE c.id = _candidate_id
  LIMIT 1;

  IF _candidate_company_id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found.';
  END IF;

  IF NOT _is_super_admin AND _candidate_company_id <> _actor_company_id THEN
    RAISE EXCEPTION 'You cannot delete candidates outside your company.';
  END IF;

  CREATE TEMP TABLE pg_temp._privacy_applications(id uuid PRIMARY KEY) ON COMMIT DROP;
  CREATE TEMP TABLE pg_temp._privacy_assignments(id uuid PRIMARY KEY) ON COMMIT DROP;
  CREATE TEMP TABLE pg_temp._privacy_lead_submissions(id uuid PRIMARY KEY) ON COMMIT DROP;
  CREATE TEMP TABLE pg_temp._privacy_feedback(id uuid PRIMARY KEY) ON COMMIT DROP;
  CREATE TEMP TABLE pg_temp._privacy_screening_submissions(id uuid PRIMARY KEY) ON COMMIT DROP;

  INSERT INTO pg_temp._privacy_applications(id)
  SELECT a.id
  FROM public.applications a
  WHERE a.company_id = _candidate_company_id
    AND a.candidate_id = _candidate_id;

  INSERT INTO pg_temp._privacy_assignments(id)
  SELECT cfa.id
  FROM public.candidate_form_assignments cfa
  WHERE cfa.company_id = _candidate_company_id
    AND cfa.candidate_id = _candidate_id;

  INSERT INTO pg_temp._privacy_lead_submissions(id)
  SELECT lfs.id
  FROM public.lead_form_submissions lfs
  WHERE lfs.company_id = _candidate_company_id
    AND (
      lfs.candidate_id = _candidate_id
      OR lfs.assignment_id IN (SELECT id FROM pg_temp._privacy_assignments)
    );

  INSERT INTO pg_temp._privacy_feedback(id)
  SELECT i.id
  FROM public.interview_feedback i
  WHERE i.company_id = _candidate_company_id
    AND i.candidate_id = _candidate_id;

  IF _candidate_email <> '' THEN
    INSERT INTO pg_temp._privacy_screening_submissions(id)
    SELECT ss.id
    FROM public.screening_submissions ss
    WHERE ss.company_id = _candidate_company_id
      AND lower(trim(ss.candidate_email)) = _candidate_email;
  END IF;

  SELECT count(*) INTO _application_count FROM pg_temp._privacy_applications;
  SELECT count(*) INTO _assignment_count FROM pg_temp._privacy_assignments;
  SELECT count(*) INTO _lead_submission_count FROM pg_temp._privacy_lead_submissions;
  SELECT count(*) INTO _feedback_count FROM pg_temp._privacy_feedback;
  SELECT count(*) INTO _screening_submission_count FROM pg_temp._privacy_screening_submissions;

  PERFORM set_config('app.privacy_erasure', 'on', true);

  DELETE FROM public.consent_records cr
  WHERE cr.company_id = _candidate_company_id
    AND (
      cr.candidate_id = _candidate_id
      OR cr.application_id IN (SELECT id FROM pg_temp._privacy_applications)
      OR cr.assignment_id IN (SELECT id FROM pg_temp._privacy_assignments)
      OR cr.submission_id IN (SELECT id FROM pg_temp._privacy_lead_submissions)
      OR cr.interview_feedback_id IN (SELECT id FROM pg_temp._privacy_feedback)
      OR cr.screening_submission_id IN (SELECT id FROM pg_temp._privacy_screening_submissions)
    );
  GET DIAGNOSTICS _consent_count = ROW_COUNT;

  DELETE FROM public.email_send_log esl
  WHERE esl.company_id = _candidate_company_id
    AND (
      esl.candidate_id = _candidate_id
      OR esl.application_id IN (SELECT id FROM pg_temp._privacy_applications)
    );
  GET DIAGNOSTICS _email_log_count = ROW_COUNT;

  IF to_regclass('pgmq.q_application_emails') IS NOT NULL THEN
    DELETE FROM pgmq.q_application_emails q
    WHERE q.message->>'application_id' IN (
      SELECT id::text FROM pg_temp._privacy_applications
    );
    GET DIAGNOSTICS _queued_email_count = ROW_COUNT;
  END IF;

  IF to_regclass('pgmq.a_application_emails') IS NOT NULL THEN
    DELETE FROM pgmq.a_application_emails q
    WHERE q.message->>'application_id' IN (
      SELECT id::text FROM pg_temp._privacy_applications
    );
    GET DIAGNOSTICS _archived_queued_email_count = ROW_COUNT;
  END IF;

  DELETE FROM public.feedback_links fl
  WHERE fl.company_id = _candidate_company_id
    AND (
      fl.candidate_id = _candidate_id
      OR fl.application_id IN (SELECT id FROM pg_temp._privacy_applications)
    );
  GET DIAGNOSTICS _feedback_link_count = ROW_COUNT;

  DELETE FROM public.candidate_tag_assignments cta
  WHERE cta.company_id = _candidate_company_id
    AND cta.candidate_id = _candidate_id;
  GET DIAGNOSTICS _tag_assignment_count = ROW_COUNT;

  UPDATE public.candidate_form_assignments cfa
  SET reset_of = NULL
  WHERE cfa.reset_of IN (SELECT id FROM pg_temp._privacy_assignments);

  DELETE FROM public.screening_submissions ss
  WHERE ss.id IN (SELECT id FROM pg_temp._privacy_screening_submissions);

  DELETE FROM public.candidates c
  WHERE c.id = _candidate_id
    AND c.company_id = _candidate_company_id;
  GET DIAGNOSTICS _candidate_count = ROW_COUNT;

  IF _candidate_count <> 1 THEN
    RAISE EXCEPTION 'Candidate deletion failed.';
  END IF;

  RETURN jsonb_build_object(
    'candidate_id', _candidate_id,
    'applications', _application_count,
    'form_assignments', _assignment_count,
    'lead_submissions', _lead_submission_count,
    'interview_feedback', _feedback_count,
    'screening_submissions', _screening_submission_count,
    'consent_records', _consent_count,
    'email_logs', _email_log_count,
    'queued_emails', _queued_email_count,
    'archived_queued_emails', _archived_queued_email_count,
    'feedback_links', _feedback_link_count,
    'tag_assignments', _tag_assignment_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_candidate_for_privacy(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_candidate_for_privacy(uuid) TO authenticated;
