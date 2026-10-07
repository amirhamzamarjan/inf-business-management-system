-- ====================================================================
-- INFORMIX BD — QUOTATION SYSTEM MIGRATION (ADDITIVE & NON-DESTRUCTIVE)
-- Multi-User, Role-Based Access Control, Safe Conversion to Invoices
-- ====================================================================

-- 1. Add quotation prefix and sequence to business_settings
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS quotation_prefix TEXT NOT NULL DEFAULT 'QT';

ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS quotation_sequence INT NOT NULL DEFAULT 1;

-- 2. Create Quotations Table
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  customer_email TEXT,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Converted to Invoice')),
  converted_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  converted_invoice_number TEXT,
  notes TEXT,
  terms TEXT[],
  prepared_by_name TEXT,
  prepared_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_quotations_number ON public.quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON public.quotations(date);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);

-- 3. Create Quotation Items Table (Cascade Delete with Quotation)
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty NUMERIC(10, 2) NOT NULL DEFAULT 1,
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.quotation_items(quotation_id);

-- 4. Add source_quotation_id to invoices for bidirectional relationship
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS source_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_source_quotation ON public.invoices(source_quotation_id);

-- 5. Auto Updated_at Trigger for Quotations
DROP TRIGGER IF EXISTS tr_quotations_updated_at ON public.quotations;
CREATE TRIGGER tr_quotations_updated_at 
BEFORE UPDATE ON public.quotations 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Sequential Quotation Number Generator Function
CREATE OR REPLACE FUNCTION public.get_next_quotation_number()
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_seq INT;
  v_year TEXT;
  v_result TEXT;
BEGIN
  SELECT quotation_prefix, quotation_sequence
  INTO v_prefix, v_seq
  FROM public.business_settings
  LIMIT 1
  FOR UPDATE;

  IF v_prefix IS NULL THEN v_prefix := 'QT'; END IF;
  IF v_seq IS NULL THEN v_seq := 1; END IF;

  v_year := to_char(CURRENT_DATE, 'YYYY');
  v_result := v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 6, '0');

  UPDATE public.business_settings
  SET quotation_sequence = v_seq + 1;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Atomic Quotation-to-Invoice Conversion Function
CREATE OR REPLACE FUNCTION public.convert_quotation_to_invoice(p_quotation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_q public.quotations%ROWTYPE;
  v_inv_id UUID;
  v_inv_num TEXT;
  v_item RECORD;
BEGIN
  -- 1. Lock and fetch quotation
  SELECT * INTO v_q FROM public.quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  -- 2. Prevent duplicate conversion
  IF v_q.converted_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'Quotation has already been converted to invoice %', v_q.converted_invoice_number;
  END IF;

  -- 3. Generate sequential invoice number
  v_inv_num := public.get_next_invoice_number();

  -- 4. Create invoice snapshot
  INSERT INTO public.invoices (
    invoice_number,
    date,
    due_date,
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    customer_email,
    subtotal,
    discount,
    tax_percent,
    tax_amount,
    other_charges,
    grand_total,
    paid_amount,
    due_amount,
    payment_method,
    payment_status,
    notes,
    terms,
    prepared_by_name,
    prepared_by_id,
    source_quotation_id
  ) VALUES (
    v_inv_num,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days',
    v_q.customer_id,
    v_q.customer_name,
    v_q.customer_phone,
    v_q.customer_address,
    v_q.customer_email,
    v_q.subtotal,
    v_q.discount,
    v_q.tax_percent,
    v_q.tax_amount,
    v_q.other_charges,
    v_q.grand_total,
    0,
    v_q.grand_total,
    'Cash',
    'Due',
    v_q.notes,
    v_q.terms,
    v_q.prepared_by_name,
    v_q.prepared_by_id,
    v_q.id
  ) RETURNING id INTO v_inv_id;

  -- 5. Copy quotation items to invoice items
  FOR v_item IN SELECT * FROM public.quotation_items WHERE quotation_id = v_q.id ORDER BY sort_order ASC LOOP
    INSERT INTO public.invoice_items (
      invoice_id,
      description,
      qty,
      rate,
      total,
      sort_order
    ) VALUES (
      v_inv_id,
      v_item.description,
      v_item.qty,
      v_item.rate,
      v_item.total,
      v_item.sort_order
    );
  END LOOP;

  -- 6. Update quotation status & link converted invoice
  UPDATE public.quotations
  SET status = 'Converted to Invoice',
      converted_invoice_id = v_inv_id,
      converted_invoice_number = v_inv_num,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_q.id;

  -- 7. Log activity
  INSERT INTO public.activities (user_id, type, message, amount, entity_type, entity_id)
  VALUES (
    v_q.prepared_by_id,
    'invoice',
    'Quotation ' || v_q.quotation_number || ' converted to Invoice ' || v_inv_num,
    v_q.grand_total,
    'invoice',
    v_inv_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_inv_id,
    'invoice_number', v_inv_num,
    'quotation_id', v_q.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Row Level Security Policies
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read quotations" ON public.quotations;
CREATE POLICY "Authenticated users can read quotations" ON public.quotations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert quotations" ON public.quotations;
CREATE POLICY "Authenticated users can insert quotations" ON public.quotations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update quotations" ON public.quotations;
CREATE POLICY "Authenticated users can update quotations" ON public.quotations FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Super Admins can delete quotations" ON public.quotations;
CREATE POLICY "Super Admins can delete quotations" ON public.quotations FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated users can read quotation items" ON public.quotation_items;
CREATE POLICY "Authenticated users can read quotation items" ON public.quotation_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert quotation items" ON public.quotation_items;
CREATE POLICY "Authenticated users can insert quotation items" ON public.quotation_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update quotation items" ON public.quotation_items;
CREATE POLICY "Authenticated users can update quotation items" ON public.quotation_items FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete quotation items" ON public.quotation_items;
CREATE POLICY "Authenticated users can delete quotation items" ON public.quotation_items FOR DELETE TO authenticated USING (true);
