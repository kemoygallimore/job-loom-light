-- Production already has these grants, but they were absent from a clean replay
-- of repository migrations. Reasserting them is additive and idempotent.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.interview_feedback
  TO authenticated;
