
-- Screening Jobs table
CREATE TABLE public.screening_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  question text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  unique_link_id text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Screening Submissions table
CREATE TABLE public.screening_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_job_id uuid NOT NULL REFERENCES public.screening_jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  candidate_name text NOT NULL,
  candidate_email text NOT NULL,
  video_url text NOT NULL,
  rating smallint CHECK (rating >= 1 AND rating <= 5),
  notes text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'watched')),
  privacy_consent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Screening Analytics (preserved after cleanup)
CREATE TABLE public.screening_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  screening_job_id uuid,
  job_title text NOT NULL,
  total_submissions integer NOT NULL DEFAULT 0,
  archived_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.screening_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_analytics ENABLE ROW LEVEL SECURITY;

-- screening_jobs policies
CREATE POLICY "Users can view screening jobs" ON public.screening_jobs
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create screening jobs" ON public.screening_jobs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users can update screening jobs" ON public.screening_jobs
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can delete screening jobs" ON public.screening_jobs
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view screening jobs by link" ON public.screening_jobs
  FOR SELECT TO anon
  USING (expires_at > now());

-- screening_submissions policies
CREATE POLICY "Users can view submissions" ON public.screening_submissions
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can update submissions" ON public.screening_submissions
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Public can create submissions" ON public.screening_submissions
  FOR INSERT TO anon
  WITH CHECK (true);

-- screening_analytics policies
CREATE POLICY "Users can view own analytics" ON public.screening_analytics
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Super admins can view all analytics" ON public.screening_analytics
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can view all screening jobs" ON public.screening_jobs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can view all submissions" ON public.screening_submissions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Storage bucket for screening videos
INSERT INTO storage.buckets (id, name, public) VALUES ('screening-videos', 'screening-videos', true);

-- Storage policies for screening videos
CREATE POLICY "Anyone can upload screening videos" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'screening-videos');

CREATE POLICY "Anyone can view screening videos" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'screening-videos');

CREATE POLICY "Authenticated can view screening videos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'screening-videos');

CREATE POLICY "Authenticated can delete screening videos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'screening-videos');
