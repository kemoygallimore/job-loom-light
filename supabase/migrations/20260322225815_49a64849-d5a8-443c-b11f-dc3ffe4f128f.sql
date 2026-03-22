-- Add slug column to companies
ALTER TABLE public.companies ADD COLUMN slug text UNIQUE;

-- Create function to generate slug from company name
CREATE OR REPLACE FUNCTION public.generate_company_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  base_slug := lower(regexp_replace(trim(NEW.name), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.companies WHERE slug = final_slug AND id != NEW.id);
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate slug on insert/update
CREATE TRIGGER set_company_slug
  BEFORE INSERT OR UPDATE OF name ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_company_slug();

-- Backfill existing companies
UPDATE public.companies SET slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;

-- Make slug NOT NULL after backfill
ALTER TABLE public.companies ALTER COLUMN slug SET NOT NULL;

-- Create resumes storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', true);

-- Allow anyone to upload to resumes bucket
CREATE POLICY "Anyone can upload resumes"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'resumes');

-- Allow anyone to read resumes
CREATE POLICY "Anyone can read resumes"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'resumes');

-- Allow public access to companies for careers pages
CREATE POLICY "Public can view companies by slug"
ON public.companies FOR SELECT
TO anon
USING (true);

-- Allow public access to open jobs
CREATE POLICY "Public can view open jobs"
ON public.jobs FOR SELECT
TO anon
USING (status = 'open'::job_status);

-- Allow public to insert candidates
CREATE POLICY "Public can create candidates"
ON public.candidates FOR INSERT
TO anon
WITH CHECK (true);

-- Allow public to insert applications
CREATE POLICY "Public can create applications"
ON public.applications FOR INSERT
TO anon
WITH CHECK (true);