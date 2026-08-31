INSERT INTO public.company_features (company_id)
SELECT c.id
FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_feature_enabled(_company_id uuid, _feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enabled boolean;
  default_enabled boolean;
BEGIN
  default_enabled := CASE _feature
    WHEN 'assessment' THEN false
    WHEN 'public_careers' THEN true
    WHEN 'guest_feedback' THEN true
    WHEN 'email_notifications' THEN false
    WHEN 'custom_email_domain' THEN false
    ELSE false
  END;

  IF _feature IS NULL OR _feature NOT IN (
    'assessment',
    'public_careers',
    'guest_feedback',
    'email_notifications',
    'custom_email_domain'
  ) THEN
    RETURN false;
  END IF;

  EXECUTE format(
    'SELECT %I FROM public.company_features WHERE company_id = $1',
    'feature_' || _feature
  ) INTO enabled USING _company_id;

  RETURN coalesce(enabled, default_enabled, false);
END;
$$;

REVOKE ALL ON FUNCTION public.is_feature_enabled(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_company_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_features (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_company_features() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ensure_company_features_after_company_insert ON public.companies;
CREATE TRIGGER ensure_company_features_after_company_insert
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_company_features();
