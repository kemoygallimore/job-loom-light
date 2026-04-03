
-- Make resumes bucket private
UPDATE storage.buckets SET public = false WHERE id = 'resumes';

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload resumes" ON storage.objects;

-- Allow anonymous uploads scoped to resumes bucket (needed for public career page applications)
CREATE POLICY "Anon can upload resumes"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'resumes');

-- Authenticated users in the same company can read resumes (path starts with company_id)
CREATE POLICY "Company users can read resumes"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- Authenticated users in the same company can upload resumes
CREATE POLICY "Company users can upload resumes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);
