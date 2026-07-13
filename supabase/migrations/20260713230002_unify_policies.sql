-- Consolidate platform/company policies into one policy model.
-- New canonical tables:
--   public.policies
--   public.policy_versions

DROP TRIGGER IF EXISTS trg_platform_policy_snapshot ON public.platform_policies;

CREATE TABLE public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('platform', 'company')),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  draft_title text NOT NULL,
  draft_content_html text NOT NULL DEFAULT '',
  published_version_id uuid,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_type, company_id, key),
  CHECK (key ~ '^[a-z0-9_]+$'),
  CHECK (length(trim(draft_title)) > 0),
  CHECK (
    (owner_type = 'platform' AND company_id IS NULL)
    OR (owner_type = 'company' AND company_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX policies_platform_key_unique
  ON public.policies(key)
  WHERE owner_type = 'platform' AND company_id IS NULL;

CREATE INDEX policies_company_idx
  ON public.policies(company_id)
  WHERE owner_type = 'company';

CREATE TABLE public.policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  owner_type text NOT NULL CHECK (owner_type IN ('platform', 'company')),
  company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  key text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  content_html text NOT NULL DEFAULT '',
  published_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, version_number),
  CHECK (key ~ '^[a-z0-9_]+$'),
  CHECK (
    (owner_type = 'platform' AND company_id IS NULL)
    OR (owner_type = 'company' AND company_id IS NOT NULL)
  )
);

CREATE INDEX policy_versions_owner_key_idx
  ON public.policy_versions(owner_type, key, published_at DESC);

CREATE INDEX policy_versions_company_key_idx
  ON public.policy_versions(company_id, key, published_at DESC)
  WHERE owner_type = 'company';

INSERT INTO public.policies (
  owner_type,
  company_id,
  key,
  draft_title,
  draft_content_html,
  updated_by,
  created_at,
  updated_at
)
SELECT
  'platform',
  NULL,
  key,
  title,
  coalesce(content_html, ''),
  updated_by,
  updated_at,
  updated_at
FROM public.platform_policies
ON CONFLICT (key) WHERE owner_type = 'platform' AND company_id IS NULL DO UPDATE
SET draft_title = EXCLUDED.draft_title,
    draft_content_html = EXCLUDED.draft_content_html,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.policies (
  id,
  owner_type,
  company_id,
  key,
  draft_title,
  draft_content_html,
  created_by,
  updated_by,
  created_at,
  updated_at
)
SELECT
  id,
  'company',
  company_id,
  key,
  draft_title,
  draft_content_html,
  created_by,
  updated_by,
  created_at,
  updated_at
FROM public.company_policies
ON CONFLICT (id) DO UPDATE
SET draft_title = EXCLUDED.draft_title,
    draft_content_html = EXCLUDED.draft_content_html,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

WITH numbered_platform_versions AS (
  SELECT
    pv.id,
    p.id AS policy_id,
    pv.key,
    pv.title,
    coalesce(pv.content_html, '') AS content_html,
    pv.updated_by,
    pv.updated_at,
    row_number() OVER (
      PARTITION BY pv.key
      ORDER BY pv.updated_at ASC, pv.id ASC
    )::integer AS version_number
  FROM public.platform_policy_versions pv
  JOIN public.policies p
    ON p.owner_type = 'platform'
   AND p.company_id IS NULL
   AND p.key = pv.key
)
INSERT INTO public.policy_versions (
  id,
  policy_id,
  owner_type,
  company_id,
  key,
  version_number,
  title,
  content_html,
  published_by,
  published_at,
  created_at
)
SELECT
  id,
  policy_id,
  'platform',
  NULL,
  key,
  version_number,
  title,
  content_html,
  updated_by,
  updated_at,
  updated_at
FROM numbered_platform_versions
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.policy_versions (
  policy_id,
  owner_type,
  company_id,
  key,
  version_number,
  title,
  content_html,
  published_by,
  published_at,
  created_at
)
SELECT
  p.id,
  'platform',
  NULL,
  p.key,
  1,
  p.draft_title,
  p.draft_content_html,
  p.updated_by,
  p.updated_at,
  p.updated_at
FROM public.policies p
WHERE p.owner_type = 'platform'
  AND p.company_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.policy_versions pv
    WHERE pv.policy_id = p.id
  );

INSERT INTO public.policy_versions (
  id,
  policy_id,
  owner_type,
  company_id,
  key,
  version_number,
  title,
  content_html,
  published_by,
  published_at,
  created_at
)
SELECT
  v.id,
  v.policy_id,
  'company',
  v.company_id,
  v.key,
  v.version_number,
  v.title,
  v.content_html,
  v.published_by,
  v.published_at,
  v.published_at
FROM public.company_policy_versions v
ON CONFLICT (id) DO NOTHING;

WITH latest_platform_versions AS (
  SELECT DISTINCT ON (policy_id)
    policy_id,
    id
  FROM public.policy_versions
  WHERE owner_type = 'platform'
  ORDER BY policy_id, published_at DESC, version_number DESC, id DESC
)
UPDATE public.policies p
SET published_version_id = latest.id
FROM latest_platform_versions latest
WHERE p.id = latest.policy_id
  AND p.owner_type = 'platform';

UPDATE public.policies p
SET published_version_id = cp.published_version_id
FROM public.company_policies cp
WHERE p.id = cp.id
  AND p.owner_type = 'company'
  AND cp.published_version_id IS NOT NULL;

ALTER TABLE public.policies
  ADD CONSTRAINT policies_published_version_fk
  FOREIGN KEY (published_version_id) REFERENCES public.policy_versions(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS update_policies_updated_at ON public.policies;
CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS prevent_policy_version_update ON public.policy_versions;
CREATE TRIGGER prevent_policy_version_update
  BEFORE UPDATE OR DELETE ON public.policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_audit_change();

CREATE OR REPLACE FUNCTION public.snapshot_platform_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _version_id uuid;
  _next_version integer;
BEGIN
  IF NEW.owner_type <> 'platform' OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.draft_title IS NOT DISTINCT FROM OLD.draft_title
     AND NEW.draft_content_html IS NOT DISTINCT FROM OLD.draft_content_html THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(max(version_number), 0) + 1
    INTO _next_version
  FROM public.policy_versions
  WHERE policy_id = NEW.id;

  INSERT INTO public.policy_versions (
    policy_id,
    owner_type,
    company_id,
    key,
    version_number,
    title,
    content_html,
    published_by
  ) VALUES (
    NEW.id,
    'platform',
    NULL,
    NEW.key,
    _next_version,
    NEW.draft_title,
    NEW.draft_content_html,
    NEW.updated_by
  )
  RETURNING id INTO _version_id;

  UPDATE public.policies
  SET published_version_id = _version_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_policy_snapshot ON public.policies;
CREATE TRIGGER trg_platform_policy_snapshot
  AFTER INSERT OR UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_platform_policy();

ALTER TABLE public.consent_records
  DROP CONSTRAINT IF EXISTS consent_records_platform_policy_version_id_fkey,
  DROP CONSTRAINT IF EXISTS consent_records_company_policy_version_id_fkey;

ALTER TABLE public.consent_records
  ADD CONSTRAINT consent_records_platform_policy_version_id_fkey
    FOREIGN KEY (platform_policy_version_id) REFERENCES public.policy_versions(id) ON DELETE SET NULL,
  ADD CONSTRAINT consent_records_company_policy_version_id_fkey
    FOREIGN KEY (company_policy_version_id) REFERENCES public.policy_versions(id) ON DELETE SET NULL;

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage platform policies" ON public.policies;
CREATE POLICY "Super admins manage platform policies"
ON public.policies
FOR ALL TO authenticated
USING (
  owner_type = 'platform'
  AND company_id IS NULL
  AND public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
)
WITH CHECK (
  owner_type = 'platform'
  AND company_id IS NULL
  AND public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Authenticated users read platform policies" ON public.policies;
CREATE POLICY "Authenticated users read platform policies"
ON public.policies
FOR SELECT TO authenticated
USING (owner_type = 'platform' AND company_id IS NULL);

DROP POLICY IF EXISTS "Company admins manage company policies" ON public.policies;
CREATE POLICY "Company admins manage company policies"
ON public.policies
FOR ALL TO authenticated
USING (
  owner_type = 'company'
  AND company_id = public.get_user_company_id((SELECT auth.uid()))
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
)
WITH CHECK (
  owner_type = 'company'
  AND company_id = public.get_user_company_id((SELECT auth.uid()))
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Super admins read company policies" ON public.policies;
CREATE POLICY "Super admins read company policies"
ON public.policies
FOR SELECT TO authenticated
USING (
  owner_type = 'company'
  AND public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Super admins read policy versions" ON public.policy_versions;
CREATE POLICY "Super admins read policy versions"
ON public.policy_versions
FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Company admins read company policy versions" ON public.policy_versions;
CREATE POLICY "Company admins read company policy versions"
ON public.policy_versions
FOR SELECT TO authenticated
USING (
  owner_type = 'company'
  AND company_id = public.get_user_company_id((SELECT auth.uid()))
  AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Authenticated users read platform policy versions" ON public.policy_versions;
CREATE POLICY "Authenticated users read platform policy versions"
ON public.policy_versions
FOR SELECT TO authenticated
USING (owner_type = 'platform' AND company_id IS NULL);

GRANT SELECT, INSERT, UPDATE ON public.policies TO authenticated;
GRANT SELECT ON public.policy_versions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.policy_versions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.publish_company_policy(
  _policy_key text,
  _title text,
  _content_html text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _policy_id uuid;
  _version_id uuid;
  _next_version integer;
BEGIN
  _company_id := public.get_user_company_id((SELECT auth.uid()));

  IF _company_id IS NULL OR NOT public.has_role((SELECT auth.uid()), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only company admins can publish company policies.';
  END IF;
  IF coalesce(trim(_policy_key), '') = '' OR _policy_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid policy key.';
  END IF;
  IF coalesce(trim(_title), '') = '' THEN
    RAISE EXCEPTION 'Policy title is required.';
  END IF;
  IF coalesce(trim(_content_html), '') = '' THEN
    RAISE EXCEPTION 'Policy content is required.';
  END IF;

  INSERT INTO public.policies (
    owner_type, company_id, key, draft_title, draft_content_html, created_by, updated_by
  ) VALUES (
    'company', _company_id, _policy_key, trim(_title), _content_html, (SELECT auth.uid()), (SELECT auth.uid())
  )
  ON CONFLICT (owner_type, company_id, key) DO UPDATE
    SET draft_title = EXCLUDED.draft_title,
        draft_content_html = EXCLUDED.draft_content_html,
        updated_by = (SELECT auth.uid()),
        updated_at = now()
  RETURNING id INTO _policy_id;

  SELECT coalesce(max(version_number), 0) + 1
    INTO _next_version
  FROM public.policy_versions
  WHERE policy_id = _policy_id;

  INSERT INTO public.policy_versions (
    policy_id, owner_type, company_id, key, version_number, title, content_html, published_by
  ) VALUES (
    _policy_id, 'company', _company_id, _policy_key, _next_version, trim(_title), _content_html, (SELECT auth.uid())
  )
  RETURNING id INTO _version_id;

  UPDATE public.policies
  SET published_version_id = _version_id,
      draft_title = trim(_title),
      draft_content_html = _content_html,
      updated_by = (SELECT auth.uid()),
      updated_at = now()
  WHERE id = _policy_id;

  RETURN _version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_platform_policy(_key text)
RETURNS TABLE (key text, title text, content_html text, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.key,
    coalesce(v.title, p.draft_title),
    coalesce(v.content_html, p.draft_content_html),
    coalesce(v.published_at, p.updated_at)
  FROM public.policies p
  LEFT JOIN LATERAL (
    SELECT pv.*
    FROM public.policy_versions pv
    WHERE pv.policy_id = p.id
    ORDER BY
      CASE WHEN pv.id = p.published_version_id THEN 0 ELSE 1 END,
      pv.published_at DESC,
      pv.version_number DESC
    LIMIT 1
  ) v ON true
  WHERE p.owner_type = 'platform'
    AND p.company_id IS NULL
    AND p.key = _key
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_company_policy(
  _company_slug text,
  _policy_key text DEFAULT 'candidate_privacy_notice'
) RETURNS TABLE (
  company_id uuid,
  company_name text,
  company_slug text,
  policy_key text,
  title text,
  content_html text,
  version_id uuid,
  version_number integer,
  published_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.slug,
    v.key,
    v.title,
    v.content_html,
    v.id,
    v.version_number,
    v.published_at
  FROM public.companies c
  JOIN public.policies p
    ON p.company_id = c.id
   AND p.owner_type = 'company'
   AND p.key = _policy_key
  JOIN public.policy_versions v
    ON v.id = p.published_version_id
  WHERE c.slug = _company_slug
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_consent_policy_context(
  _company_id uuid,
  _policy_key text DEFAULT 'candidate_privacy_notice'
) RETURNS TABLE (
  company_id uuid,
  company_name text,
  company_slug text,
  platform_policy_key text,
  platform_policy_title text,
  platform_policy_version_id uuid,
  platform_policy_updated_at timestamptz,
  company_policy_key text,
  company_policy_title text,
  company_policy_version_id uuid,
  company_policy_published_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH platform AS (
    SELECT v.id, v.key, v.title, v.published_at
    FROM public.policies p
    JOIN LATERAL (
      SELECT pv.*
      FROM public.policy_versions pv
      WHERE pv.policy_id = p.id
      ORDER BY
        CASE WHEN pv.id = p.published_version_id THEN 0 ELSE 1 END,
        pv.published_at DESC,
        pv.version_number DESC
      LIMIT 1
    ) v ON true
    WHERE p.owner_type = 'platform'
      AND p.company_id IS NULL
      AND p.key = 'data_protection'
    LIMIT 1
  ),
  company_policy AS (
    SELECT v.id, v.key, v.title, v.published_at
    FROM public.policies p
    JOIN public.policy_versions v ON v.id = p.published_version_id
    WHERE p.owner_type = 'company'
      AND p.company_id = _company_id
      AND p.key = _policy_key
    LIMIT 1
  )
  SELECT
    c.id,
    c.name,
    c.slug,
    platform.key,
    platform.title,
    platform.id,
    platform.published_at,
    company_policy.key,
    company_policy.title,
    company_policy.id,
    company_policy.published_at
  FROM public.companies c
  LEFT JOIN platform ON true
  LEFT JOIN company_policy ON true
  WHERE c.id = _company_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.record_consent(
  _company_id uuid,
  _consent_key text,
  _source_flow text,
  _consent_text text,
  _candidate_id uuid DEFAULT NULL,
  _application_id uuid DEFAULT NULL,
  _submission_id uuid DEFAULT NULL,
  _screening_submission_id uuid DEFAULT NULL,
  _assignment_id uuid DEFAULT NULL,
  _interview_feedback_id uuid DEFAULT NULL,
  _page_path text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _platform record;
  _company_policy record;
  _consent_id uuid;
BEGIN
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required for consent records.';
  END IF;
  IF coalesce(trim(_consent_key), '') = '' OR _consent_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid consent key.';
  END IF;
  IF coalesce(trim(_source_flow), '') = '' OR _source_flow !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Invalid consent source.';
  END IF;
  IF coalesce(trim(_consent_text), '') = '' THEN
    RAISE EXCEPTION 'Consent text is required.';
  END IF;

  SELECT v.id, v.key, v.title, v.published_at
    INTO _platform
  FROM public.policies p
  JOIN LATERAL (
    SELECT pv.*
    FROM public.policy_versions pv
    WHERE pv.policy_id = p.id
    ORDER BY
      CASE WHEN pv.id = p.published_version_id THEN 0 ELSE 1 END,
      pv.published_at DESC,
      pv.version_number DESC
    LIMIT 1
  ) v ON true
  WHERE p.owner_type = 'platform'
    AND p.company_id IS NULL
    AND p.key = 'data_protection'
  LIMIT 1;

  SELECT v.id, v.key, v.title, v.published_at
    INTO _company_policy
  FROM public.policies p
  JOIN public.policy_versions v ON v.id = p.published_version_id
  WHERE p.owner_type = 'company'
    AND p.company_id = _company_id
    AND p.key = 'candidate_privacy_notice'
  LIMIT 1;

  INSERT INTO public.consent_records (
    company_id,
    candidate_id,
    application_id,
    submission_id,
    screening_submission_id,
    assignment_id,
    interview_feedback_id,
    consent_key,
    source_flow,
    consent_text,
    platform_policy_key,
    platform_policy_version_id,
    platform_policy_title,
    platform_policy_updated_at,
    company_policy_key,
    company_policy_version_id,
    company_policy_title,
    company_policy_published_at,
    page_path,
    metadata
  ) VALUES (
    _company_id,
    _candidate_id,
    _application_id,
    _submission_id,
    _screening_submission_id,
    _assignment_id,
    _interview_feedback_id,
    _consent_key,
    _source_flow,
    trim(_consent_text),
    _platform.key,
    _platform.id,
    _platform.title,
    _platform.published_at,
    _company_policy.key,
    _company_policy.id,
    _company_policy.title,
    _company_policy.published_at,
    nullif(trim(coalesce(_page_path, '')), ''),
    coalesce(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO _consent_id;

  RETURN _consent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_company_policy(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_company_policy(text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_platform_policy(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_platform_policy(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_company_policy(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_company_policy(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_consent_policy_context(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_consent_policy_context(uuid, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.record_consent(uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_consent(uuid, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb) TO authenticated, service_role;

DROP TRIGGER IF EXISTS update_company_policies_updated_at ON public.company_policies;
DROP TRIGGER IF EXISTS prevent_company_policy_version_update ON public.company_policy_versions;

DROP TABLE IF EXISTS
  public.company_policy_versions,
  public.company_policies,
  public.platform_policy_versions,
  public.platform_policies;
