
-- Tag library per company
CREATE TABLE public.candidate_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'gray',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX candidate_tags_company_label_unique
  ON public.candidate_tags (company_id, lower(label));

ALTER TABLE public.candidate_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view tags in company"
  ON public.candidate_tags FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins insert tags"
  ON public.candidate_tags FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins update tags"
  ON public.candidate_tags FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins delete tags"
  ON public.candidate_tags FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Tag assignments
CREATE TABLE public.candidate_tag_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.candidate_tags(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, tag_id)
);

CREATE INDEX candidate_tag_assignments_candidate_idx
  ON public.candidate_tag_assignments (candidate_id);

ALTER TABLE public.candidate_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view tag assignments in company"
  ON public.candidate_tag_assignments FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users assign tags in company"
  ON public.candidate_tag_assignments FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users remove tags in company"
  ON public.candidate_tag_assignments FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
