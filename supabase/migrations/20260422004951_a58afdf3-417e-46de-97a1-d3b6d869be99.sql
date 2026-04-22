-- Drop redundant recruiter_name column from interview_feedback
-- The feedback_by column will be used for both guest and internal feedback names
ALTER TABLE public.interview_feedback DROP COLUMN IF EXISTS recruiter_name;

-- Add comment to clarify feedback_by usage
COMMENT ON COLUMN public.interview_feedback.feedback_by IS 'Name of the person providing feedback (for guests) or pulled from profiles for internal users';
COMMENT ON COLUMN public.interview_feedback.submitted_by IS 'UUID reference to authenticated user (null for guest submissions)';