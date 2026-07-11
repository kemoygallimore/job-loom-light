-- Hiring evaluation foundation: scored job screening, candidate-only forms,
-- company interview scorecards, and job-scoped pipeline summaries.

CREATE TYPE public.screening_question_type AS ENUM
  ('yes_no', 'single_choice', 'multi_select', 'number', 'short_text', 'long_text');
CREATE TYPE public.screening_response_status AS ENUM
  ('provisional', 'final');
CREATE TYPE public.form_assignment_status AS ENUM
  ('pending', 'verified', 'completed', 'expired', 'revoked', 'superseded');

CREATE TABLE public.job_screening_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'locked', 'archived')),
  created_by uuid NOT NULL REFERENCES public.profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  locked_at timestamptz,
  UNIQUE (job_id, version)
);

CREATE UNIQUE INDEX job_screening_one_current_idx
  ON public.job_screening_versions(job_id)
  WHERE status IN ('draft', 'published');

CREATE TABLE public.job_screening_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.job_screening_versions(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  type public.screening_question_type NOT NULL,
  prompt text NOT NULL CHECK (length(trim(prompt)) > 0),
  required boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  rubric jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, position),
  CHECK (
    type NOT IN ('short_text', 'long_text')
    OR jsonb_typeof(rubric) = 'object'
  )
);

CREATE TABLE public.job_screening_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.job_screening_questions(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  label text NOT NULL CHECK (length(trim(label)) > 0),
  credit_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (credit_percent BETWEEN 0 AND 100),
  UNIQUE (question_id, position)
);

CREATE TABLE public.job_screening_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  application_id uuid NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.job_screening_versions(id),
  status public.screening_response_status NOT NULL,
  score numeric(5,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  review_needed_count integer NOT NULL DEFAULT 0 CHECK (review_needed_count >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

CREATE TABLE public.job_screening_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.job_screening_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.job_screening_questions(id),
  answer jsonb NOT NULL,
  earned_percent numeric(5,2) CHECK (earned_percent BETWEEN 0 AND 100),
  rubric_level smallint CHECK (rubric_level BETWEEN 1 AND 5),
  graded_by uuid REFERENCES public.profiles(user_id),
  graded_at timestamptz,
  UNIQUE (response_id, question_id),
  CHECK ((graded_at IS NULL AND graded_by IS NULL) OR (graded_at IS NOT NULL AND graded_by IS NOT NULL))
);

CREATE INDEX job_screening_response_review_idx
  ON public.job_screening_responses(company_id, status, submitted_at DESC);
CREATE INDEX job_screening_response_application_idx
  ON public.job_screening_responses(application_id);

CREATE TABLE public.candidate_form_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id),
  token_hash text NOT NULL UNIQUE,
  status public.form_assignment_status NOT NULL DEFAULT 'pending',
  schema_snapshot jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  access_token_hash text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  reset_of uuid REFERENCES public.candidate_form_assignments(id),
  CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX candidate_form_one_active_idx
  ON public.candidate_form_assignments(form_id, candidate_id)
  WHERE status IN ('pending', 'verified', 'completed');

CREATE TABLE public.candidate_form_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.candidate_form_assignments(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_form_submissions
  ADD COLUMN assignment_id uuid UNIQUE REFERENCES public.candidate_form_assignments(id) ON DELETE CASCADE,
  ADD COLUMN candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE;

CREATE INDEX candidate_form_history_idx
  ON public.candidate_form_assignments(candidate_id, created_at DESC);

CREATE TABLE public.interview_scorecard_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid NOT NULL REFERENCES public.profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (company_id, version)
);

CREATE UNIQUE INDEX interview_scorecard_current_idx
  ON public.interview_scorecard_versions(company_id)
  WHERE status IN ('draft', 'published');

CREATE TABLE public.interview_scorecard_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.interview_scorecard_versions(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 9),
  label text NOT NULL CHECK (length(trim(label)) > 0),
  description text,
  UNIQUE (version_id, position)
);

ALTER TABLE public.interview_feedback
  ADD COLUMN scorecard_version_id uuid REFERENCES public.interview_scorecard_versions(id),
  ADD COLUMN summary text,
  ADD COLUMN panelist_average numeric(3,2) CHECK (panelist_average BETWEEN 1 AND 5),
  ADD COLUMN scorecard_snapshot jsonb,
  ADD COLUMN ratings jsonb;

CREATE INDEX interview_feedback_job_candidate_idx
  ON public.interview_feedback(job_id, candidate_id, submitted_at DESC);

-- Company isolation on all new exposed tables.
ALTER TABLE public.job_screening_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_screening_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_screening_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_screening_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_screening_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_form_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_form_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecard_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecard_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users manage screening versions" ON public.job_screening_versions
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id((SELECT auth.uid())))
  WITH CHECK (company_id = public.get_user_company_id((SELECT auth.uid())));
CREATE POLICY "Company users manage screening questions" ON public.job_screening_questions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_screening_versions v WHERE v.id = version_id AND v.company_id = public.get_user_company_id((SELECT auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.job_screening_versions v WHERE v.id = version_id AND v.company_id = public.get_user_company_id((SELECT auth.uid()))));
CREATE POLICY "Company users manage screening choices" ON public.job_screening_choices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_screening_questions q JOIN public.job_screening_versions v ON v.id = q.version_id WHERE q.id = question_id AND v.company_id = public.get_user_company_id((SELECT auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.job_screening_questions q JOIN public.job_screening_versions v ON v.id = q.version_id WHERE q.id = question_id AND v.company_id = public.get_user_company_id((SELECT auth.uid()))));
CREATE POLICY "Company users view screening responses" ON public.job_screening_responses
  FOR SELECT TO authenticated USING (company_id = public.get_user_company_id((SELECT auth.uid())));
CREATE POLICY "Company users view screening answers" ON public.job_screening_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_screening_responses r WHERE r.id = response_id AND r.company_id = public.get_user_company_id((SELECT auth.uid()))));
CREATE POLICY "Applicants submit screening responses" ON public.job_screening_responses
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.job_screening_versions v ON v.job_id = a.job_id
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = application_id AND a.company_id = company_id
        AND v.id = version_id AND v.status = 'published' AND j.status = 'open'
    )
  );
CREATE POLICY "Applicants submit screening answers" ON public.job_screening_answers
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_screening_responses r
      JOIN public.job_screening_questions q ON q.version_id = r.version_id
      WHERE r.id = response_id AND q.id = question_id
    )
  );
CREATE POLICY "Company users manage form assignments" ON public.candidate_form_assignments
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id((SELECT auth.uid())))
  WITH CHECK (company_id = public.get_user_company_id((SELECT auth.uid())));
CREATE POLICY "Company users manage scorecards" ON public.interview_scorecard_versions
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id((SELECT auth.uid())))
  WITH CHECK (company_id = public.get_user_company_id((SELECT auth.uid())));
CREATE POLICY "Company users manage scorecard areas" ON public.interview_scorecard_areas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interview_scorecard_versions v WHERE v.id = version_id AND v.company_id = public.get_user_company_id((SELECT auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.interview_scorecard_versions v WHERE v.id = version_id AND v.company_id = public.get_user_company_id((SELECT auth.uid()))));
CREATE POLICY "Guests read published scorecard" ON public.interview_scorecard_versions
  FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Guests read published scorecard areas" ON public.interview_scorecard_areas
  FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.interview_scorecard_versions v WHERE v.id = version_id AND v.status = 'published'));

-- Public readers can load only a published screening attached to an open job.
CREATE POLICY "Public reads active screening versions" ON public.job_screening_versions
  FOR SELECT TO anon
  USING (status = 'published' AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.status = 'open'));
CREATE POLICY "Public reads active screening questions" ON public.job_screening_questions
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.job_screening_versions v JOIN public.jobs j ON j.id = v.job_id WHERE v.id = version_id AND v.status = 'published' AND j.status = 'open'));
CREATE POLICY "Public reads active screening choices" ON public.job_screening_choices
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.job_screening_questions q JOIN public.job_screening_versions v ON v.id = q.version_id JOIN public.jobs j ON j.id = v.job_id WHERE q.id = question_id AND v.status = 'published' AND j.status = 'open'));

CREATE OR REPLACE FUNCTION public.lock_screening_version_on_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.job_screening_versions SET status = 'locked', locked_at = now()
  WHERE id = NEW.version_id AND status = 'published';
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lock_screening_version_on_response() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lock_screening_version_after_first_response
  AFTER INSERT ON public.job_screening_responses
  FOR EACH ROW EXECUTE FUNCTION public.lock_screening_version_on_response();

CREATE OR REPLACE FUNCTION public.grade_written_screening_answer(
  _answer_id uuid,
  _rubric_level smallint
) RETURNS public.job_screening_answers
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _answer public.job_screening_answers; _response_id uuid;
BEGIN
  IF _rubric_level NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Rubric level must be 1-5'; END IF;
  UPDATE public.job_screening_answers a
    SET rubric_level = _rubric_level,
        earned_percent = (_rubric_level - 1) * 25,
        graded_by = (SELECT auth.uid()),
        graded_at = now()
  WHERE a.id = _answer_id
    AND a.graded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.job_screening_responses r
      WHERE r.id = a.response_id AND r.company_id = public.get_user_company_id((SELECT auth.uid()))
    )
  RETURNING a.* INTO _answer;
  IF NOT FOUND THEN RAISE EXCEPTION 'Answer is already graded or unavailable'; END IF;
  _response_id := _answer.response_id;
  UPDATE public.job_screening_responses r SET
    review_needed_count = x.pending,
    status = CASE WHEN x.pending = 0 THEN 'final'::public.screening_response_status ELSE 'provisional'::public.screening_response_status END,
    score = x.score,
    finalized_at = CASE WHEN x.pending = 0 THEN now() ELSE NULL END
  FROM (
    SELECT count(*) FILTER (WHERE a2.earned_percent IS NULL)::integer pending,
           round(coalesce(avg(coalesce(a2.earned_percent, 0)), 0), 2) score
    FROM public.job_screening_answers a2 WHERE a2.response_id = _response_id
  ) x WHERE r.id = _response_id;
  RETURN _answer;
END $$;

CREATE OR REPLACE FUNCTION public.get_job_pipeline(
  _job_id uuid,
  _search text DEFAULT NULL,
  _screening_min numeric DEFAULT NULL,
  _screening_max numeric DEFAULT NULL,
  _screening_status text DEFAULT NULL,
  _interview_min numeric DEFAULT NULL,
  _interview_max numeric DEFAULT NULL,
  _sort text DEFAULT 'screening_desc'
) RETURNS TABLE (
  id uuid, job_id uuid, candidate_id uuid, stage public.application_stage,
  company_id uuid, candidate_name text, candidate_email text, job_title text,
  hiring_manager text, screening_score numeric, screening_status text,
  review_needed_count integer, interview_average numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT a.id, a.job_id, a.candidate_id, a.stage, a.company_id,
         c.name, c.email, j.title, j.hiring_manager,
         sr.score, sr.status::text, sr.review_needed_count,
         round(avg(f.panelist_average), 1)
  FROM public.applications a
  JOIN public.candidates c ON c.id = a.candidate_id
  JOIN public.jobs j ON j.id = a.job_id
  LEFT JOIN public.job_screening_responses sr ON sr.application_id = a.id
  LEFT JOIN public.interview_feedback f ON f.candidate_id = a.candidate_id AND f.job_id = a.job_id AND f.panelist_average IS NOT NULL
  WHERE a.job_id = _job_id
    AND a.company_id = public.get_user_company_id((SELECT auth.uid()))
    AND (_search IS NULL OR c.name ILIKE '%' || _search || '%' OR c.email ILIKE '%' || _search || '%')
    AND (_screening_min IS NULL OR sr.score >= _screening_min)
    AND (_screening_max IS NULL OR sr.score <= _screening_max)
    AND (_screening_status IS NULL OR sr.status::text = _screening_status)
  GROUP BY a.id, c.name, c.email, j.title, j.hiring_manager, sr.score, sr.status, sr.review_needed_count
  HAVING (_interview_min IS NULL OR avg(f.panelist_average) >= _interview_min)
     AND (_interview_max IS NULL OR avg(f.panelist_average) <= _interview_max)
  ORDER BY
    CASE WHEN _sort = 'screening_desc' AND sr.status = 'final' THEN 0 WHEN _sort = 'screening_desc' AND sr.status = 'provisional' THEN 1 ELSE 2 END,
    CASE WHEN _sort = 'screening_desc' THEN sr.score END DESC NULLS LAST,
    CASE WHEN _sort = 'interview_desc' THEN avg(f.panelist_average) END DESC NULLS LAST,
    CASE WHEN _sort = 'name_asc' THEN lower(c.name) END ASC,
    CASE WHEN _sort = 'oldest' THEN a.created_at END ASC,
    a.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.reset_candidate_form_assignment(
  _assignment_id uuid,
  _token_hash text,
  _expires_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _old public.candidate_form_assignments; _new_id uuid;
BEGIN
  IF NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only company admins can reset form eligibility';
  END IF;
  SELECT * INTO _old FROM public.candidate_form_assignments
  WHERE id = _assignment_id
    AND company_id = public.get_user_company_id((SELECT auth.uid()))
    AND status = 'completed'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completed assignment not found'; END IF;
  UPDATE public.candidate_form_assignments SET status = 'superseded' WHERE id = _old.id;
  INSERT INTO public.candidate_form_assignments (
    company_id, form_id, candidate_id, created_by, token_hash,
    schema_snapshot, expires_at, reset_of
  ) VALUES (
    _old.company_id, _old.form_id, _old.candidate_id, (SELECT auth.uid()), _token_hash,
    _old.schema_snapshot, _expires_at, _old.id
  ) RETURNING id INTO _new_id;
  RETURN _new_id;
END $$;

REVOKE ALL ON FUNCTION public.grade_written_screening_answer(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_written_screening_answer(uuid, smallint) TO authenticated;
REVOKE ALL ON FUNCTION public.get_job_pipeline(uuid, text, numeric, numeric, text, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_pipeline(uuid, text, numeric, numeric, text, numeric, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.reset_candidate_form_assignment(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_candidate_form_assignment(uuid, text, timestamptz) TO authenticated;

-- Candidate-only cutover. Data deletion is deliberately confirmation-gated;
-- deployment must call this function explicitly after reviewing row counts.
CREATE OR REPLACE FUNCTION public.purge_legacy_anonymous_form_submissions(_confirmation text)
RETURNS TABLE (deleted_submissions bigint, deleted_upload_records bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _submission_count bigint; _upload_count bigint;
BEGIN
  IF _confirmation <> 'DELETE LEGACY ANONYMOUS FORM SUBMISSIONS' THEN
    RAISE EXCEPTION 'Explicit deletion confirmation is required';
  END IF;
  SELECT count(*) INTO _submission_count FROM public.lead_form_submissions WHERE candidate_id IS NULL;
  SELECT count(*) INTO _upload_count FROM public.lead_form_uploads u
    WHERE EXISTS (SELECT 1 FROM public.lead_form_submissions s WHERE s.id = u.submission_id AND s.candidate_id IS NULL);
  DELETE FROM public.lead_form_submissions WHERE candidate_id IS NULL;
  RETURN QUERY SELECT _submission_count, _upload_count;
END $$;
REVOKE ALL ON FUNCTION public.purge_legacy_anonymous_form_submissions(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_public_lead_form(text, uuid, jsonb, jsonb, jsonb) FROM anon, authenticated;
DROP POLICY IF EXISTS "Public submits active lead forms" ON public.lead_form_submissions;
DROP POLICY IF EXISTS "Public records active lead uploads" ON public.lead_form_uploads;
DROP POLICY IF EXISTS "Public can submit active lead forms" ON public.lead_form_submissions;
