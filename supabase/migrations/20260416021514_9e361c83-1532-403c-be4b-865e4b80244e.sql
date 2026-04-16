
ALTER TABLE public.candidates
  ADD COLUMN country text,
  ADD COLUMN street_address text,
  ADD COLUMN parish_state text,
  ADD COLUMN education_level text;
