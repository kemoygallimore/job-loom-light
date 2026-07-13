ALTER TABLE public.job_screening_answers
  ADD COLUMN IF NOT EXISTS answer_display jsonb;

UPDATE public.job_screening_answers a
SET answer_display = CASE
  WHEN q.type IN ('yes_no', 'single_choice') THEN coalesce((
    SELECT to_jsonb(choice.label)
    FROM public.job_screening_choices choice
    WHERE choice.question_id = a.question_id
      AND choice.id::text = (a.answer #>> '{}')
    LIMIT 1
  ), a.answer)
  WHEN q.type = 'multi_select' THEN coalesce((
    SELECT jsonb_agg(to_jsonb(coalesce(choice.label, selected.choice_id)) ORDER BY selected.position)
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(a.answer) = 'array' THEN a.answer
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS selected(choice_id, position)
    LEFT JOIN public.job_screening_choices choice
      ON choice.question_id = a.question_id
     AND choice.id::text = selected.choice_id
  ), '[]'::jsonb)
  ELSE a.answer
END
FROM public.job_screening_questions q
WHERE q.id = a.question_id
  AND a.answer_display IS NULL;

DO $$
DECLARE
  _function_oid oid;
  _function_sql text;
BEGIN
  SELECT p.oid
  INTO _function_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'submit_public_job_application'
    AND oidvectortypes(p.proargtypes) = 'uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb';

  IF _function_oid IS NULL THEN
    RAISE EXCEPTION 'Expected function public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb) was not found';
  END IF;

  _function_sql := pg_get_functiondef(_function_oid);

  IF position('answer_display jsonb' IN _function_sql) > 0 THEN
    RAISE NOTICE 'submit_public_job_application already snapshots readable screening answers';
  ELSE
    IF position('TRUNCATE TABLE pg_temp._screening_answer_scores;' IN _function_sql) = 0 THEN
      _function_sql := replace(
        _function_sql,
        'DELETE FROM pg_temp._screening_answer_scores;',
        'TRUNCATE TABLE pg_temp._screening_answer_scores;'
      );
    END IF;

    _function_sql := replace(
      _function_sql,
      '      answer jsonb,
      earned_percent numeric(5,2)',
      '      answer jsonb,
      answer_display jsonb,
      earned_percent numeric(5,2)'
    );

    _function_sql := replace(
      _function_sql,
      '    INSERT INTO pg_temp._screening_answer_scores(question_id, answer, earned_percent)',
      '    INSERT INTO pg_temp._screening_answer_scores(question_id, answer, answer_display, earned_percent)'
    );

    _function_sql := replace(
      _function_sql,
      '        coalesce(_screening_answers -> q.id::text, ''null''::jsonb),
        CASE',
      '        coalesce(_screening_answers -> q.id::text, ''null''::jsonb),
        CASE
          WHEN q.type = ''multi_select'' THEN coalesce((
            SELECT jsonb_agg(to_jsonb(coalesce(c.label, selected.choice_id)) ORDER BY selected.position)
            FROM jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(coalesce(_screening_answers -> q.id::text, ''[]''::jsonb)) = ''array''
                THEN coalesce(_screening_answers -> q.id::text, ''[]''::jsonb)
                ELSE ''[]''::jsonb
              END
            ) WITH ORDINALITY AS selected(choice_id, position)
            LEFT JOIN public.job_screening_choices c
              ON c.question_id = q.id
             AND c.id::text = selected.choice_id
          ), ''[]''::jsonb)
          WHEN q.type IN (''yes_no'', ''single_choice'') THEN coalesce((
            SELECT to_jsonb(c.label)
            FROM public.job_screening_choices c
            WHERE c.question_id = q.id
              AND c.id::text = (_screening_answers ->> q.id::text)
            LIMIT 1
          ), coalesce(_screening_answers -> q.id::text, ''null''::jsonb))
          ELSE coalesce(_screening_answers -> q.id::text, ''null''::jsonb)
        END AS answer_display,
        CASE'
    );

    _function_sql := replace(
      _function_sql,
      '      answer,
      earned_percent',
      '      answer,
      answer_display,
      earned_percent'
    );

    _function_sql := replace(
      _function_sql,
      '      s.answer,
      s.earned_percent',
      '      s.answer,
      s.answer_display,
      s.earned_percent'
    );

    IF position('answer_display jsonb' IN _function_sql) = 0 THEN
      RAISE EXCEPTION 'Failed to patch submit_public_job_application with answer_display support';
    END IF;

    EXECUTE _function_sql;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_job_application(uuid, uuid, jsonb, jsonb, jsonb, uuid, jsonb) TO anon;
