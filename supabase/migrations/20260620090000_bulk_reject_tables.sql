-- Create bulk_actions and application_audit tables for tracking bulk operations
CREATE TABLE IF NOT EXISTS public.bulk_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  initiated_by uuid REFERENCES public.profiles(user_id),
  filter_json jsonb,
  total_count integer,
  processed_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_count integer DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bulk_actions_company_idx ON public.bulk_actions(company_id);

CREATE TABLE IF NOT EXISTS public.application_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_action_id uuid REFERENCES public.bulk_actions(id),
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  old_stage text,
  new_stage text,
  changed_by uuid,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_audit_bulk_idx ON public.application_audit(bulk_action_id);
CREATE INDEX IF NOT EXISTS application_audit_app_idx ON public.application_audit(application_id);
