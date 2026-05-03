
-- 1. Fix privilege escalation: remove self-insert on user_roles
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

-- 2. Restrict public companies exposure: drop anon SELECT, expose via SECURITY DEFINER function
DROP POLICY IF EXISTS "Public can view companies by slug" ON public.companies;

CREATE OR REPLACE FUNCTION public.get_public_company_by_slug(_slug text)
RETURNS TABLE(id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug
  FROM public.companies c
  WHERE c.slug = _slug
    AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.company_id = c.id AND j.status = 'open')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_company_by_slug(text) TO anon, authenticated;

-- 3. Tighten anon candidate insert: require the target company has at least one open job
DROP POLICY IF EXISTS "Public can create candidates for existing companies" ON public.candidates;
CREATE POLICY "Public can create candidates for companies with open jobs"
ON public.candidates
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.company_id = candidates.company_id
      AND j.status = 'open'
  )
);

-- 4. Fix broken screening_submissions check (sj.company_id = sj.company_id was always true)
DROP POLICY IF EXISTS "Public can submit active screening responses" ON public.screening_submissions;
CREATE POLICY "Public can submit active screening responses"
ON public.screening_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  privacy_consent = true
  AND EXISTS (
    SELECT 1 FROM public.screening_jobs sj
    WHERE sj.id = screening_submissions.screening_job_id
      AND sj.company_id = screening_submissions.company_id
      AND sj.expires_at > now()
  )
);

-- 5. Lock down storage: make screening-videos private, remove anon read/upload on storage
UPDATE storage.buckets SET public = false WHERE id = 'screening-videos';

DROP POLICY IF EXISTS "Anon can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view screening videos" ON storage.objects;
