ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS max_open_jobs integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
