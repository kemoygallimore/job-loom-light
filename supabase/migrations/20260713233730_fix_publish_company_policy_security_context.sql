-- Allow the trusted publish RPC to create immutable policy version rows.
-- Direct INSERT/UPDATE/DELETE on policy_versions remains revoked for tenants.

ALTER FUNCTION public.publish_company_policy(text, text, text)
  SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.publish_company_policy(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_company_policy(text, text, text)
  TO authenticated;
