-- Add new pipeline stages to the application_stage enum
ALTER TYPE public.application_stage ADD VALUE IF NOT EXISTS 'scheduling' BEFORE 'interview';
ALTER TYPE public.application_stage ADD VALUE IF NOT EXISTS '1st_interview' AFTER 'scheduling';
ALTER TYPE public.application_stage ADD VALUE IF NOT EXISTS '2nd_interview' AFTER '1st_interview';