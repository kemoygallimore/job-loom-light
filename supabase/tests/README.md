Staging verification guide for bulk-reject feature

Steps to run verification in staging:

1. Create test data
   - Open `supabase/tests/generate_test_data.sql` in the Supabase SQL editor.
   - Replace `<COMPANY_ID>` and `<JOB_ID>` with your staging values and run the script.

2. Dry-run the bulk-reject function
   - Export env vars:

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SERVICE_ROLE_KEY="<service-role-key>"
export ANON_KEY="<anon-key>"
export AUTH_TOKEN="< a staging user's access token >"
export COMPANY_ID="<company-uuid>"
export JOB_ID="<job-uuid>"
```

   - Run the staging verify script to perform a dry-run and optionally a real run:

```bash
chmod +x ./scripts/staging-verify.sh
./scripts/staging-verify.sh
```

3. Inspect results
   - Use the Supabase SQL editor or `psql` to verify:

```sql
SELECT count(*) FROM public.applications WHERE company_id = '<COMPANY_ID>'::uuid AND job_id = '<JOB_ID>'::uuid AND stage = 'rejected';
SELECT count(*) FROM public.application_audit WHERE bulk_action_id = '<bulk_action_id>'::uuid;
SELECT * FROM public.bulk_actions WHERE id = '<bulk_action_id>'::uuid;
```

4. Undo
   - The staging script offers an optional undo step; you can also call the function directly:

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/undo-bulk-action" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"bulk_action_id":"<bulk_action_id>","company_id":"<COMPANY_ID>"}'
```

Notes:
- Running the real-run will modify staging data. Do not run against production.
- The script expects `jq` and `curl` installed. `psql` is optional.
