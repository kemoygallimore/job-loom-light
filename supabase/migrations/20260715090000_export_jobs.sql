CREATE TYPE public.export_job_type AS ENUM ('form_submissions', 'candidates', 'pipeline');
CREATE TYPE public.export_job_scope AS ENUM ('current_view', 'full_dataset');
CREATE TYPE public.export_job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'expired', 'deleted');

CREATE TABLE public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  export_type public.export_job_type NOT NULL,
  scope public.export_job_scope NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  filter_summary text NOT NULL DEFAULT 'Full dataset',
  status public.export_job_status NOT NULL DEFAULT 'queued',
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  r2_bucket text,
  r2_key text,
  filename text,
  expires_at timestamptz,
  download_count integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  last_downloaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_downloaded_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT export_jobs_completed_file_check CHECK (
    status <> 'completed'
    OR (r2_bucket IS NOT NULL AND r2_key IS NOT NULL AND filename IS NOT NULL AND expires_at IS NOT NULL)
  )
);

CREATE INDEX export_jobs_company_created_idx ON public.export_jobs(company_id, created_at DESC);
CREATE INDEX export_jobs_requester_created_idx ON public.export_jobs(requested_by, created_at DESC);
CREATE INDEX export_jobs_expiry_idx ON public.export_jobs(status, expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX export_jobs_type_idx ON public.export_jobs(company_id, export_type, created_at DESC);

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters and admins can view export jobs"
  ON public.export_jobs
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id((SELECT auth.uid()))
    AND (
      requested_by = (SELECT auth.uid())
      OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    )
  );

GRANT SELECT ON public.export_jobs TO authenticated;
GRANT ALL ON public.export_jobs TO service_role;
