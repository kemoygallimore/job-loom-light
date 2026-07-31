BEGIN;
ALTER TABLE IF EXISTS public.interview_feedback
  ADD COLUMN IF NOT EXISTS source text;
UPDATE public.interview_feedback
SET source = 'internal'
WHERE source IS NULL;
ALTER TABLE public.interview_feedback
  ALTER COLUMN source SET DEFAULT 'internal',
  ALTER COLUMN source SET NOT NULL;
NOTIFY pgrst, 'reload schema';
COMMIT;
