-- ============= interview_feedback table =============
CREATE TABLE IF NOT EXISTS public.interview_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  job_id uuid NOT NULL,
  company_id uuid NOT NULL,
  submitted_by uuid,
  feedback_text text NOT NULL,
  feedback_by text,
  recruiter_name text,
  feedback_date date,
  hiring_manager text,
  strengths text,
  opportunities text,
  weaknesses text,
  rating smallint CHECK (rating >= 1 AND rating <= 5),
  source text NOT NULL DEFAULT 'internal',
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view feedback in company" ON public.interview_feedback
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users create feedback in company" ON public.interview_feedback
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update feedback in company" ON public.interview_feedback
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users delete feedback in company" ON public.interview_feedback
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- ============= feedback_links table =============
CREATE TABLE IF NOT EXISTS public.feedback_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  company_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  job_id uuid NOT NULL,
  application_id uuid,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view feedback links" ON public.feedback_links
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users create feedback links" ON public.feedback_links
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Admins delete feedback links" ON public.feedback_links
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public view active feedback links" ON public.feedback_links
  FOR SELECT TO anon
  USING (expires_at > now());

-- Allow guest panelists (anon) to submit feedback via valid link
CREATE POLICY "Guests submit feedback via valid link" ON public.interview_feedback
  FOR INSERT TO anon
  WITH CHECK (
    source = 'guest'
    AND EXISTS (
      SELECT 1 FROM public.feedback_links fl
      WHERE fl.candidate_id = interview_feedback.candidate_id
        AND fl.job_id = interview_feedback.job_id
        AND fl.company_id = interview_feedback.company_id
        AND fl.expires_at > now()
    )
  );
