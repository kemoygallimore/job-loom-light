# Stage F — Deploy Checklist (External Supabase project)

Project ref: `jfiyvvigvknfemqfnucl`

## 1. Apply migration
Run `docs/billing-stage-f-migration.sql` in SQL Editor.

## 2. Add secrets (Edge Functions → Secrets)
- `CRON_SECRET` — long random string; used by pg_cron and internal callers
- `RESEND_API_KEY` — already added in Stage E
- `RESEND_FROM` — optional, e.g. `Billing <billing@yourdomain.com>`
- `R2_WORKER_BASE_URL`, `R2_WORKER_SECRET` — already added

## 3. Deploy edge functions (Supabase CLI)
```bash
supabase functions deploy billing-auto-renewal   --project-ref jfiyvvigvknfemqfnucl
supabase functions deploy billing-send-reminders --project-ref jfiyvvigvknfemqfnucl
supabase functions deploy mark-invoice-paid      --project-ref jfiyvvigvknfemqfnucl
supabase functions deploy send-invoice-email     --project-ref jfiyvvigvknfemqfnucl  # updated to accept x-cron-secret
```

## 4. Schedule cron jobs
Enable `pg_cron` and `pg_net` extensions (Database → Extensions), then run
(replace `<CRON_SECRET>`):

```sql
SELECT cron.schedule(
  'billing-auto-renewal-daily', '0 6 * * *',
  $$ SELECT net.http_post(
    url:='https://jfiyvvigvknfemqfnucl.supabase.co/functions/v1/billing-auto-renewal',
    headers:='{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
    body:='{"window_days":30,"auto_issue":true,"auto_email":true}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'billing-send-reminders-daily', '15 6 * * *',
  $$ SELECT net.http_post(
    url:='https://jfiyvvigvknfemqfnucl.supabase.co/functions/v1/billing-send-reminders',
    headers:='{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
    body:='{}'::jsonb
  ); $$
);
```

## 5. Manual test
```bash
# Generate drafts for the next 30 days (dry-ish: drafts only)
curl -X POST 'https://jfiyvvigvknfemqfnucl.supabase.co/functions/v1/billing-auto-renewal' \
  -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" \
  -d '{"window_days":30}'

# Send pending reminders
curl -X POST 'https://jfiyvvigvknfemqfnucl.supabase.co/functions/v1/billing-send-reminders' \
  -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" -d '{}'
```

## Notes
- `billing-auto-renewal` skips a company if a draft already exists for that `period_start`, or if the billing profile is incomplete.
- `billing-send-reminders` sends `pre_due` (7 days out), `due` (day of), then `overdue` every 7 days up to 4 times. It also auto-flips `sent` → `overdue` once past due.
- `mark-invoice-paid` advances `company_subscriptions.renewal_date` to `period_end` when the paid invoice covers the current renewal cycle, and emails a receipt.