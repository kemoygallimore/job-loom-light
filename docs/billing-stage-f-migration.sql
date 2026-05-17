-- =====================================================================
-- Stage F — Auto-renewal, reminders, mark-paid + receipts
-- Run on the EXTERNAL Supabase project (jfiyvvigvknfemqfnucl) via
-- Dashboard → SQL Editor.
-- Prereqs: Stages A + B + C already applied.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PART A: Payment details + reminder tracking on invoices
-- ---------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method     text,
  ADD COLUMN IF NOT EXISTS payment_reference  text,
  ADD COLUMN IF NOT EXISTS reminders_sent     jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------
-- PART B: Update lock_paid_invoices to allow payment fields at mark-paid
--   time and to always allow reminders_sent updates (audit-only field).
--   payment_method / payment_reference become locked AFTER status=paid is
--   committed (we treat them as part of the paid snapshot).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_paid_invoices()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    IF (
      NEW.company_id      IS DISTINCT FROM OLD.company_id      OR
      NEW.invoice_number  IS DISTINCT FROM OLD.invoice_number  OR
      NEW.status          IS DISTINCT FROM OLD.status          OR
      NEW.currency        IS DISTINCT FROM OLD.currency        OR
      NEW.subtotal_cents  IS DISTINCT FROM OLD.subtotal_cents  OR
      NEW.discount_cents  IS DISTINCT FROM OLD.discount_cents  OR
      NEW.total_cents     IS DISTINCT FROM OLD.total_cents     OR
      NEW.period_start    IS DISTINCT FROM OLD.period_start    OR
      NEW.period_end      IS DISTINCT FROM OLD.period_end      OR
      NEW.issued_at       IS DISTINCT FROM OLD.issued_at       OR
      NEW.due_at          IS DISTINCT FROM OLD.due_at          OR
      NEW.paid_at         IS DISTINCT FROM OLD.paid_at         OR
      NEW.payment_method     IS DISTINCT FROM OLD.payment_method     OR
      NEW.payment_reference  IS DISTINCT FROM OLD.payment_reference  OR
      NEW.bill_to_legal_name    IS DISTINCT FROM OLD.bill_to_legal_name    OR
      NEW.bill_to_email         IS DISTINCT FROM OLD.bill_to_email         OR
      NEW.bill_to_contact_name  IS DISTINCT FROM OLD.bill_to_contact_name  OR
      NEW.bill_to_phone         IS DISTINCT FROM OLD.bill_to_phone         OR
      NEW.bill_to_address       IS DISTINCT FROM OLD.bill_to_address       OR
      NEW.bill_to_trn           IS DISTINCT FROM OLD.bill_to_trn           OR
      NEW.bill_to_customer_code IS DISTINCT FROM OLD.bill_to_customer_code
    ) THEN
      RAISE EXCEPTION 'Paid invoice % is locked; only PDF metadata and reminders_sent may change', OLD.invoice_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- PART C (optional) — pg_cron schedules for the new edge functions.
--   Enable pg_cron + pg_net extensions in Supabase Dashboard first.
--   Replace <PROJECT_REF>, <CRON_SECRET> below before running.
--   Run these as separate statements after the functions are deployed.
-- =====================================================================
--
-- SELECT cron.schedule(
--   'billing-auto-renewal-daily',
--   '0 6 * * *',  -- daily at 06:00 UTC
--   $$
--   SELECT net.http_post(
--     url:='https://<PROJECT_REF>.supabase.co/functions/v1/billing-auto-renewal',
--     headers:='{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
--     body:='{"window_days":30,"auto_issue":true,"auto_email":true}'::jsonb
--   );
--   $$
-- );
--
-- SELECT cron.schedule(
--   'billing-send-reminders-daily',
--   '15 6 * * *',  -- daily at 06:15 UTC
--   $$
--   SELECT net.http_post(
--     url:='https://<PROJECT_REF>.supabase.co/functions/v1/billing-send-reminders',
--     headers:='{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
--     body:='{}'::jsonb
--   );
--   $$
-- );

-- =====================================================================
-- Done.
-- =====================================================================