# Stages 5 & 6 — Candidate Emails Deployment

These changes target the **external** Supabase project (the one in `externalClient.ts`).

## 1. Run the migration
Open SQL editor in your external project and run:
```
docs/billing-stage-g-email-migration.sql
```
This creates `email_templates` + `email_send_log` and seeds the `application_received` template.

## 2. Set secrets (Project Settings → Edge Functions → Secrets)
- `RESEND_API_KEY` — from https://resend.com/api-keys
- `RIZONHIRE_FROM_EMAIL` — optional, defaults to `RizonHire <no-reply@rizonhire.com>`

## 3. Verify the `rizonhire.com` domain in Resend
Add the SPF/DKIM DNS records Resend gives you. Emails will hard-fail until the domain shows as "Verified".

## 4. Deploy the edge function
From your repo root:
```
supabase functions deploy send-candidate-email --project-ref <EXTERNAL_REF> --no-verify-jwt
```
The function is public (called from the unauthenticated application form).

## 5. Smoke test
- Apply to a public job; confirm a "sent" row appears in `email_send_log`.
- Open `/admin/email-templates`, edit the body, hit **Send test** to your inbox.

## Rollback
- Disable a template (toggle Active off) to stop further sends without redeploying.
- Drop tables only if you also remove the trigger in `PublicJobApplication.tsx`.
