-- =====================================================================
-- Stage 6 + Stage 7 migration — Invoicing & PDF storage
-- Run on the EXTERNAL Supabase project via Dashboard → SQL Editor.
-- Prerequisites already in place: has_role(uuid, app_role),
--   get_user_company_id(uuid), update_updated_at_column(), companies table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PART A: Extend companies with billing identity fields (needed by PDF)
-- ---------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email   text,
  ADD COLUMN IF NOT EXISTS address text;

-- ---------------------------------------------------------------------
-- PART B: Invoice status enum
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE public.invoice_status AS ENUM
      ('draft', 'sent', 'paid', 'overdue', 'void');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- PART C: Sequence + generator for invoice numbers (INV-YYYY-NNNNNN)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number :=
      'INV-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- PART D: invoices table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_number    text UNIQUE NOT NULL,
  status            public.invoice_status NOT NULL DEFAULT 'draft',
  currency          text NOT NULL DEFAULT 'USD',
  subtotal_cents    integer NOT NULL DEFAULT 0,
  discount_cents    integer NOT NULL DEFAULT 0,
  total_cents       integer NOT NULL DEFAULT 0,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  issued_at         timestamptz,
  due_at            timestamptz,
  paid_at           timestamptz,
  pdf_r2_key        text,
  pdf_generated_at  timestamptz,
  pdf_version       integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at  ON public.invoices(issued_at DESC);

DROP TRIGGER IF EXISTS trg_invoices_set_number ON public.invoices;
CREATE TRIGGER trg_invoices_set_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- PART E: invoice_line_items table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description       text NOT NULL,
  quantity          integer NOT NULL DEFAULT 1,
  unit_price_cents  integer NOT NULL DEFAULT 0,
  amount_cents      integer NOT NULL DEFAULT 0,
  source            text NOT NULL DEFAULT 'plan',  -- plan | addon | discount | manual
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id
  ON public.invoice_line_items(invoice_id);

-- ---------------------------------------------------------------------
-- PART F: Row-Level Security
-- ---------------------------------------------------------------------
ALTER TABLE public.invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items  ENABLE ROW LEVEL SECURITY;

-- invoices: super-admin full access
DROP POLICY IF EXISTS "Super admin manage invoices" ON public.invoices;
CREATE POLICY "Super admin manage invoices"
  ON public.invoices FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- invoices: tenant read-only of own company
DROP POLICY IF EXISTS "Tenant reads own invoices" ON public.invoices;
CREATE POLICY "Tenant reads own invoices"
  ON public.invoices FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

-- line items: super-admin full access
DROP POLICY IF EXISTS "Super admin manage invoice line items" ON public.invoice_line_items;
CREATE POLICY "Super admin manage invoice line items"
  ON public.invoice_line_items FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- line items: tenant read-only via parent invoice ownership
DROP POLICY IF EXISTS "Tenant reads own invoice line items" ON public.invoice_line_items;
CREATE POLICY "Tenant reads own invoice line items"
  ON public.invoice_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
        AND i.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- =====================================================================
-- Done. After running:
--   1. Deploy edge functions: request-invoice-pdf, get-invoice-download-url
--   2. Set secrets: R2_WORKER_BASE_URL, R2_WORKER_SECRET
-- =====================================================================