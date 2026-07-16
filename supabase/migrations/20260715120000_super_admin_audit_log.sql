CREATE TABLE public.super_admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX super_admin_action_log_company_created_idx
  ON public.super_admin_action_log(company_id, created_at DESC);

CREATE INDEX super_admin_action_log_action_created_idx
  ON public.super_admin_action_log(action, created_at DESC);

ALTER TABLE public.super_admin_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view action logs"
  ON public.super_admin_action_log
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role));

CREATE POLICY "Super admins can insert action logs"
  ON public.super_admin_action_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role));

GRANT SELECT, INSERT ON public.super_admin_action_log TO authenticated;
GRANT ALL ON public.super_admin_action_log TO service_role;
