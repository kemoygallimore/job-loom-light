-- Phase 1 storage hardening: files live in Cloudflare R2, not Supabase Storage.
-- Keep database metadata for R2 bucket/key references and remove legacy Storage policies.

ALTER TABLE public.screening_submissions
  ADD COLUMN IF NOT EXISTS video_bucket text,
  ADD COLUMN IF NOT EXISTS video_object_key text,
  ADD COLUMN IF NOT EXISTS video_filename text,
  ADD COLUMN IF NOT EXISTS video_content_type text,
  ADD COLUMN IF NOT EXISTS video_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS attempt_number integer,
  ADD COLUMN IF NOT EXISTS upload_status text;

-- If legacy Supabase Storage buckets still exist, keep them private until they
-- are emptied and deleted through the Supabase Storage API.
UPDATE storage.buckets
SET public = false
WHERE id IN ('resumes', 'screening-videos');

-- Remove legacy Supabase Storage object access paths. Current uploads and
-- signed views/deletes use the Cloudflare Worker + R2 object keys stored in DB.
DROP POLICY IF EXISTS "Anyone can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Company users can read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Company users can upload resumes" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can upload screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Company users can read screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Company admins can delete screening videos" ON storage.objects;
