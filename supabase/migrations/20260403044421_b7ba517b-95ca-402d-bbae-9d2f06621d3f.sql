
CREATE TABLE public.candidate_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  bucket TEXT NOT NULL,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_files ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view files in their company
CREATE POLICY "Company users can view candidate files"
ON public.candidate_files FOR SELECT TO authenticated
USING (company_id = get_user_company_id(auth.uid()));

-- Authenticated users can insert files for their company
CREATE POLICY "Company users can insert candidate files"
ON public.candidate_files FOR INSERT TO authenticated
WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Anonymous users can insert files (for public screening/application flows)
CREATE POLICY "Anon can insert candidate files"
ON public.candidate_files FOR INSERT TO anon
WITH CHECK (true);

-- Admins can delete files in their company
CREATE POLICY "Admins can delete candidate files"
ON public.candidate_files FOR DELETE TO authenticated
USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Super admins can view all files
CREATE POLICY "Super admins can view all candidate files"
ON public.candidate_files FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
