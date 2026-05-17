# Billing Operations Runbook

Day-to-day procedures for super-admins managing the billing subsystem.

## 1. Onboarding a new company

1. `/admin/companies` → **Create company** (sets up admin user + billing profile).
2. Open the new company → **Billing** tab.
3. Confirm/fill the billing profile: legal name, billing email, contact, address, TRN.
4. Confirm subscription start date and `renewal_date` (auto = start + 1 year).
5. Leave `auto_renew = true` unless the customer is one-off.

## 2. Manual invoice generation

1. `/admin/companies/:id` → **Billing** → **Generate invoice for next cycle**.
2. Review draft on `/admin/billing/invoices/:id`.
3. Click **Generate PDF** → **Issue** → **Send email** (`payment_due`).
4. Timeline reflects every step.

## 3. Marking an invoice paid after a bank deposit

1. Open the invoice in admin view.
2. Click **Mark paid** → enter `paid_at`, `payment_method` (e.g. `bank_transfer`),
   and `payment_reference` (deposit slip / transaction id).
3. A receipt is auto-emailed to the billing contact.
4. If the invoice covers the current `renewal_date`, the subscription automatically
   advances to `period_end`.

## 4. Re-issuing after a void

1. Open the bad invoice → **Void** (logs `voided` event).
2. From the company's Billing tab, click **Generate invoice for next cycle** again
   to recreate (or adjust `renewal_date` first if you need a different period).
3. Regenerate PDF and re-send.

## 5. Disabling auto-renewal for a company

1. `/admin/companies/:id` → **Billing** → **Billing cycle** card.
2. Toggle `auto_renew` off. The nightly `billing-auto-renewal` cron will skip
   this company going forward. Reminders still send for any existing unpaid invoices.

## 6. Cron dry-runs

Both cron functions accept `{"dry_run": true}` to preview without writes or emails.

```bash
# What would auto-renewal do today?
curl -X POST https://jfiyvvigvknfemqfnucl.supabase.co/functions/v1/billing-auto-renewal \
  -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" \
  -d '{"window_days":30,"dry_run":true}'

# What would reminders send today?
curl -X POST https://jfiyvvigvknfemqfnucl.supabase.co/functions/v1/billing-send-reminders \
  -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" \
  -d '{"dry_run":true}'
```

## 7. Reminder cadence

| Trigger | Email kind |
|---|---|
| 7 days before `due_at` | `pre_due` (once) |
| On `due_at` | `due` (once) |
| Every 7 days after `due_at` | `overdue` (max 4 reminders) |

Reminders are tracked in `invoices.reminders_sent` (jsonb) and `invoice_events`.

## 8. Common fixes

- **"Billing profile incomplete" error** — open the company's Billing profile card
  and fill `legal_name` + `billing_email` (both required).
- **PDF link expired in customer email** — customer can log into `/billing` and
  click Download (generates a fresh signed URL each click).
- **Customer paid but invoice still `sent`** — use Mark paid (Section 3).
  Do not edit the invoice row directly; the `lock_paid_invoices` trigger blocks it.
