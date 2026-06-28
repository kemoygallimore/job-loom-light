-- Phase 1 security hardening: remove broad screening-video storage access.

UPDATE storage.buckets
SET public = false
WHERE id = 'screening-videos';

ALTER TABLE public.screening_submissions
  ADD COLUMN IF NOT EXISTS video_bucket text,
  ADD COLUMN IF NOT EXISTS video_object_key text,
  ADD COLUMN IF NOT EXISTS video_filename text,
  ADD COLUMN IF NOT EXISTS video_content_type text,
  ADD COLUMN IF NOT EXISTS video_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS attempt_number integer,
  ADD COLUMN IF NOT EXISTS upload_status text;

DROP POLICY IF EXISTS "Anyone can upload screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Company users can read screening videos" ON storage.objects;
DROP POLICY IF EXISTS "Company admins can delete screening videos" ON storage.objects;

CREATE POLICY "Company users can read screening videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'screening-videos'
  AND EXISTS (
    SELECT 1
    FROM public.screening_submissions ss
    WHERE ss.company_id = public.get_user_company_id((SELECT auth.uid()))
      AND (
        ss.video_object_key = storage.objects.name
        OR ss.video_url = storage.objects.name
        OR ss.video_url LIKE ('%/screening-videos/' || storage.objects.name)
      )
  )
);

CREATE POLICY "Company admins can delete screening videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'screening-videos'
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.screening_submissions ss
    WHERE ss.company_id = public.get_user_company_id((SELECT auth.uid()))
      AND (
        ss.video_object_key = storage.objects.name
        OR ss.video_url = storage.objects.name
        OR ss.video_url LIKE ('%/screening-videos/' || storage.objects.name)
      )
  )
);
