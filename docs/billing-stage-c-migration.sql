-- =====================================================================
-- Stage C — Manual invoice generation
-- Run on the EXTERNAL Supabase project (jfiyvvigvknfemqfnucl) via
-- Dashboard → SQL Editor.
-- Prereqs: Stages A + B already applied (company_billing_profiles,
-- company_subscriptions.subscription_start_date/renewal_date/auto_renew).
-- =====================================================================

-- ---------------------------------------------------------------------
-- PART A: Bill-to snapshot columns on invoices
--   Captured at issue time; immutable afterwards.
-- ---------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bill_to_legal_name      text,
  ADD COLUMN IF NOT EXISTS bill_to_email           text,
  ADD COLUMN IF NOT EXISTS bill_to_contact_name    text,
  ADD COLUMN IF NOT EXISTS bill_to_phone           text,
  ADD COLUMN IF NOT EXISTS bill_to_address         text,
  ADD COLUMN IF NOT EXISTS bill_to_trn             text,
  ADD COLUMN IF NOT EXISTS bill_to_customer_code   text;

-- ---------------------------------------------------------------------
-- PART B: invoice_events audit table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  actor_user_id  uuid,
  event          text NOT NULL,
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice_id
  ON public.invoice_events(invoice_id, at DESC);

ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manage invoice events" ON public.invoice_events;
CREATE POLICY "Super admin manage invoice events"
  ON public.invoice_events FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Tenant reads own invoice events" ON public.invoice_events;
CREATE POLICY "Tenant reads own invoice events"
  ON public.invoice_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_events.invoice_id
        AND i.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- PART C: Lock paid invoices (except PDF columns)
--   Blocks UPDATE on a paid invoice unless only pdf_* fields changed.
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
      NEW.bill_to_legal_name    IS DISTINCT FROM OLD.bill_to_legal_name    OR
      NEW.bill_to_email         IS DISTINCT FROM OLD.bill_to_email         OR
      NEW.bill_to_contact_name  IS DISTINCT FROM OLD.bill_to_contact_name  OR
      NEW.bill_to_phone         IS DISTINCT FROM OLD.bill_to_phone         OR
      NEW.bill_to_address       IS DISTINCT FROM OLD.bill_to_address       OR
      NEW.bill_to_trn           IS DISTINCT FROM OLD.bill_to_trn           OR
      NEW.bill_to_customer_code IS DISTINCT FROM OLD.bill_to_customer_code
    ) THEN
      RAISE EXCEPTION 'Paid invoice % is locked; only PDF metadata may change', OLD.invoice_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_lock_paid ON public.invoices;
CREATE TRIGGER trg_invoices_lock_paid
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.lock_paid_invoices();

-- =====================================================================
-- Done.
-- =====================================================================
