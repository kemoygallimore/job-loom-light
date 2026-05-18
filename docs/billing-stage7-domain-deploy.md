# Stage 7 — Per-Company Sending Domains: Deploy

## 1. Database migration
Run `docs/billing-stage7-domain-migration.sql` in the external Supabase SQL editor.

## 2. Resend API key scope
The existing `RESEND_API_KEY` secret must have **Domains** read/write permission.
- Resend dashboard → API Keys → confirm the key has "Full access" (or `domains:*` scope).
- If not, rotate the key and update the secret in the external Supabase project.

## 3. Deploy edge functions
```
supabase functions deploy manage-company-domain --project-ref <EXTERNAL_REF>
supabase functions deploy send-candidate-email --project-ref <EXTERNAL_REF> --no-verify-jwt
```
`manage-company-domain` keeps JWT verification on (super-admin only).

## 4. Operator runbook
1. Super-admin → Companies → open a tenant → **Email Domain** tab.
2. Enter the sending domain (e.g. `mail.acme.com`), optional From name and Reply-to.
3. Click **Register domain** — DNS records appear.
4. Customer publishes the records at their DNS provider.
5. Click **Refresh status** to re-check, or **Verify** once DNS has propagated.
6. Once status is `verified`, all candidate emails for the tenant will be sent from `no-reply@<their-domain>`.

## 5. Troubleshooting
- **403 from Resend on register** → API key lacks domain scope.
- **Stuck on `pending`** → DNS not yet propagated; wait and Refresh.
- **Status `failed`** → records missing or incorrect; recheck the table and Verify again.
- **Wrong from address still showing** → check `email_send_log.from_address` for the actual value sent. If it still shows the RizonHire fallback, the company's `email_domain_status` is not `verified`.

## 6. Audit
- `company_email_domain_events` logs every register/verify/refresh/remove with `actor_user_id`.
- `email_send_log.from_address` and `reply_to` show the resolved sender per email.
