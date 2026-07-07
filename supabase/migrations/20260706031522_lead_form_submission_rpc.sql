CREATE OR REPLACE FUNCTION public.submit_public_lead_form(
  _public_id text,
  _submission_id uuid,
  _answers jsonb,
  _confirmation_answers jsonb DEFAULT '{}'::jsonb,
  _upload_rows jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  form_row record;
  field jsonb;
  field_id text;
  field_type text;
  field_value jsonb;
  field_text text;
  validation jsonb;
  upload_settings jsonb;
  min_length integer;
  max_length integer;
  mask_preset text;
  mask_pattern text;
  mask_regex text;
  requires_confirmation boolean;
  upload_row jsonb;
  upload_field jsonb;
  upload_size bigint;
  upload_max_mb numeric;
  allowed_categories text[];
  allowed_types text[];
  category text;
BEGIN
  SELECT lf.id, lf.company_id, lf.schema
  INTO form_row
  FROM public.lead_forms lf
  WHERE lf.public_id = _public_id
    AND lf.status = 'active'
    AND lf.deleted_at IS NULL
  LIMIT 1;

  IF form_row.id IS NULL THEN
    RAISE EXCEPTION 'Form unavailable';
  END IF;

  FOR field IN SELECT value FROM jsonb_array_elements(COALESCE(form_row.schema->'fields', '[]'::jsonb))
  LOOP
    field_id := field->>'id';
    field_type := field->>'type';
    IF field_id IS NULL OR field_type = 'section' THEN
      CONTINUE;
    END IF;

    field_value := _answers->field_id;
    IF COALESCE((field->>'required')::boolean, false)
      AND (
        field_value IS NULL
        OR field_value = 'null'::jsonb
        OR field_value = '""'::jsonb
        OR field_value = 'false'::jsonb
        OR field_value = '[]'::jsonb
      )
    THEN
      RAISE EXCEPTION 'Required field missing: %', field_id;
    END IF;

    IF field_value IS NULL OR field_value = 'null'::jsonb THEN
      CONTINUE;
    END IF;

    field_text := CASE WHEN jsonb_typeof(field_value) = 'string' THEN field_value #>> '{}' ELSE NULL END;
    validation := COALESCE(field->'validation', '{}'::jsonb);

    IF field_type = 'email' AND field_text IS NOT NULL AND field_text !~ '^\S+@\S+\.\S+$' THEN
      RAISE EXCEPTION 'Invalid email field: %', field_id;
    END IF;

    IF field_type = 'url' AND field_text IS NOT NULL AND field_text !~* '^https?://.+' THEN
      RAISE EXCEPTION 'Invalid URL field: %', field_id;
    END IF;

    min_length := NULLIF(validation->>'minLength', '')::integer;
    max_length := NULLIF(validation->>'maxLength', '')::integer;
    IF field_text IS NOT NULL AND min_length IS NOT NULL AND char_length(trim(field_text)) < min_length THEN
      RAISE EXCEPTION 'Field is shorter than allowed: %', field_id;
    END IF;
    IF field_text IS NOT NULL AND max_length IS NOT NULL AND char_length(trim(field_text)) > max_length THEN
      RAISE EXCEPTION 'Field is longer than allowed: %', field_id;
    END IF;

    mask_preset := COALESCE(validation->>'maskPreset', 'none');
    mask_pattern := CASE mask_preset
      WHEN 'phone' THEN '(999) 999-9999'
      WHEN 'zip' THEN '99999'
      WHEN 'ssn' THEN '999-99-9999'
      WHEN 'date' THEN '99/99/9999'
      WHEN 'custom' THEN COALESCE(validation->>'customMask', '')
      ELSE ''
    END;
    mask_regex := CASE mask_preset
      WHEN 'phone' THEN '^\([0-9]{3}\) [0-9]{3}-[0-9]{4}$'
      WHEN 'zip' THEN '^[0-9]{5}$'
      WHEN 'ssn' THEN '^[0-9]{3}-[0-9]{2}-[0-9]{4}$'
      WHEN 'date' THEN '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
      ELSE ''
    END;
    IF field_text IS NOT NULL AND mask_pattern <> '' AND char_length(field_text) <> char_length(mask_pattern) THEN
      RAISE EXCEPTION 'Field does not match mask length: %', field_id;
    END IF;
    IF field_text IS NOT NULL AND mask_regex <> '' AND field_text !~ mask_regex THEN
      RAISE EXCEPTION 'Field does not match mask pattern: %', field_id;
    END IF;

    requires_confirmation := COALESCE((validation->>'requireConfirmation')::boolean, false);
    IF requires_confirmation
      AND field_type IN ('text', 'email', 'phone', 'url')
      AND field_text IS DISTINCT FROM (_confirmation_answers->>field_id)
    THEN
      RAISE EXCEPTION 'Confirmation does not match: %', field_id;
    END IF;
  END LOOP;

  INSERT INTO public.lead_form_submissions (
    id,
    form_id,
    company_id,
    answers,
    schema_snapshot,
    status
  )
  VALUES (
    _submission_id,
    form_row.id,
    form_row.company_id,
    _answers,
    form_row.schema,
    'new'
  );

  FOR upload_row IN SELECT value FROM jsonb_array_elements(COALESCE(_upload_rows, '[]'::jsonb))
  LOOP
    SELECT value
    INTO upload_field
    FROM jsonb_array_elements(COALESCE(form_row.schema->'fields', '[]'::jsonb))
    WHERE value->>'id' = upload_row->>'field_id'
      AND value->>'type' = 'file'
    LIMIT 1;

    IF upload_field IS NULL THEN
      RAISE EXCEPTION 'Invalid upload field: %', upload_row->>'field_id';
    END IF;

    upload_settings := COALESCE(upload_field->'upload', '{}'::jsonb);
    upload_max_mb := COALESCE(NULLIF(upload_settings->>'maxSizeMb', '')::numeric, 10);
    upload_size := COALESCE(NULLIF(upload_row->>'file_size', '')::bigint, 0);
    IF upload_size <= 0 OR upload_size > (upload_max_mb * 1048576) THEN
      RAISE EXCEPTION 'Upload size is not allowed: %', upload_row->>'field_id';
    END IF;

    SELECT array_agg(value)
    INTO allowed_categories
    FROM jsonb_array_elements_text(COALESCE(upload_settings->'allowedCategories', '["documents","images"]'::jsonb));

    allowed_types := ARRAY[]::text[];
    FOREACH category IN ARRAY COALESCE(allowed_categories, ARRAY['documents', 'images'])
    LOOP
      IF category = 'documents' THEN
        allowed_types := allowed_types || ARRAY[
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
      ELSIF category = 'images' THEN
        allowed_types := allowed_types || ARRAY['image/png', 'image/jpeg', 'image/webp'];
      END IF;
    END LOOP;

    IF NOT (upload_row->>'file_type' = ANY(allowed_types)) THEN
      RAISE EXCEPTION 'Upload type is not allowed: %', upload_row->>'field_id';
    END IF;

    INSERT INTO public.lead_form_uploads (
      submission_id,
      form_id,
      company_id,
      field_id,
      bucket,
      object_key,
      file_name,
      file_type,
      file_size
    )
    VALUES (
      _submission_id,
      form_row.id,
      form_row.company_id,
      upload_row->>'field_id',
      upload_row->>'bucket',
      upload_row->>'object_key',
      upload_row->>'file_name',
      upload_row->>'file_type',
      upload_size
    );
  END LOOP;

  RETURN _submission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_lead_form(text, uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_lead_form(text, uuid, jsonb, jsonb, jsonb) TO anon, authenticated;

REVOKE INSERT ON public.lead_form_submissions FROM anon, authenticated;
REVOKE INSERT ON public.lead_form_uploads FROM anon, authenticated;
