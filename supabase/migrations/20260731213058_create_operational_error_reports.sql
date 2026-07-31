CREATE TABLE public.operational_error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_hash text NOT NULL CHECK (length(actor_hash) = 64),
  source text NOT NULL CHECK (source IN ('supabase', 'r2', 'browser_error', 'unhandled_rejection')),
  method text CHECK (method IS NULL OR method ~ '^[A-Z]+$'),
  http_status integer CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  service_path text,
  error_code text,
  error_message text NOT NULL,
  page_path text NOT NULL,
  stack text,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
  email_error text,
  emailed_at timestamptz
);

CREATE INDEX operational_error_reports_actor_received_idx
  ON public.operational_error_reports(actor_hash, received_at DESC);
CREATE INDEX operational_error_reports_received_idx
  ON public.operational_error_reports(received_at DESC);

ALTER TABLE public.operational_error_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.operational_error_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.operational_error_reports TO service_role;

COMMENT ON TABLE public.operational_error_reports IS
  'Sanitized client operational failures. Raw request bodies, query strings, tokens, IP addresses, candidate data, and feedback text are prohibited.';
