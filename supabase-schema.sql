-- ====================================================================
-- INFORMIX BD — SUPABASE POSTGRESQL DATABASE SCHEMA
-- Security & Surveillance Service Management System
-- Multi-User, Role-Based Access Control, Real-Time Business Records
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. TABLE DEFINITIONS
-- ====================================================================

-- --------------------------------------------------------------------
-- 2.1 Profiles Table (Linked to auth.users)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'user')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- --------------------------------------------------------------------
-- 2.2 Centralized Business Settings Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'INFORMIX BD',
  tagline TEXT DEFAULT 'Security & Surveillance Solutions',
  address TEXT DEFAULT 'Dhaka, Bangladesh',
  phone TEXT DEFAULT '+880 1XXXXXXXXX',
  email TEXT DEFAULT 'info@informixbd.com',
  website TEXT DEFAULT 'www.informixbd.com',
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT '৳',
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  receipt_prefix TEXT NOT NULL DEFAULT 'INF',
  invoice_sequence INT NOT NULL DEFAULT 1,
  receipt_sequence INT NOT NULL DEFAULT 1,
  terms TEXT[] DEFAULT ARRAY[
    'Payment is due upon receipt of invoice.',
    'Warranty applies only to specified parts and manufacturer terms.',
    'Keep this document for future warranty and service reference.'
  ],
  bank_details JSONB DEFAULT '{
    "bank_name": "City Bank Bangladesh",
    "account_name": "INFORMIX BD",
    "account_number": "1102938475001",
    "branch": "Banani Branch",
    "routing_number": "225271983",
    "bkash_merchant": "+8801700000000"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- --------------------------------------------------------------------
-- 2.3 Customers Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- --------------------------------------------------------------------
-- 2.4 Invoices Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
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
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  payment_status TEXT NOT NULL DEFAULT 'Due' CHECK (payment_status IN ('Paid', 'Partial', 'Due', 'Overdue', 'Draft')),
  notes TEXT,
  terms TEXT[],
  prepared_by_name TEXT,
  prepared_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(payment_status);

-- --------------------------------------------------------------------
-- 2.5 Invoice Items Table (Cascade Delete with Invoice)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty NUMERIC(10, 2) NOT NULL DEFAULT 1,
  rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- --------------------------------------------------------------------
-- 2.6 Money Receipts Table (Service and Money Receipts)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.money_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  service_type TEXT,
  device_name TEXT,
  device_model TEXT,
  device_serial TEXT,
  problem_description TEXT,
  work_performed TEXT,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  payment_status TEXT NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Paid', 'Partial', 'Due')),
  received_by TEXT,
  notes TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  prepared_by_name TEXT,
  prepared_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_receipts_number ON public.money_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_customer ON public.money_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON public.money_receipts(date);

-- --------------------------------------------------------------------
-- 2.7 Receipt Items Table (Cascade Delete with Receipt)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.money_receipts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON public.receipt_items(receipt_id);

-- --------------------------------------------------------------------
-- 2.8 Activities Audit Log Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'system',
  message TEXT NOT NULL,
  amount NUMERIC(12, 2),
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activities_created ON public.activities(created_at DESC);

-- ====================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- Helper Function: Check if current caller is an active Super Admin
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- Profiles Policies
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Super Admins have full control over profiles" ON public.profiles;
CREATE POLICY "Super Admins have full control over profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_super_admin());

-- --------------------------------------------------------------------
-- Business Settings Policies
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Settings viewable by authenticated users" ON public.business_settings;
CREATE POLICY "Settings viewable by authenticated users"
  ON public.business_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Settings modifiable by Super Admins only" ON public.business_settings;
CREATE POLICY "Settings modifiable by Super Admins only"
  ON public.business_settings FOR ALL
  TO authenticated
  USING (public.is_super_admin());

-- --------------------------------------------------------------------
-- Operational Records Policies (Customers, Invoices, Receipts)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
CREATE POLICY "Authenticated users can read customers" ON public.customers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
CREATE POLICY "Authenticated users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Authenticated users can update customers" ON public.customers FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Super Admins can delete customers" ON public.customers;
CREATE POLICY "Super Admins can delete customers" ON public.customers FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated users can read invoices" ON public.invoices;
CREATE POLICY "Authenticated users can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.invoices;
CREATE POLICY "Authenticated users can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.invoices;
CREATE POLICY "Authenticated users can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Super Admins can delete invoices" ON public.invoices;
CREATE POLICY "Super Admins can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated users can read invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users can read invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users can insert invoice items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users can update invoice items" ON public.invoice_items FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users can delete invoice items" ON public.invoice_items FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read receipts" ON public.money_receipts;
CREATE POLICY "Authenticated users can read receipts" ON public.money_receipts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert receipts" ON public.money_receipts;
CREATE POLICY "Authenticated users can insert receipts" ON public.money_receipts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update receipts" ON public.money_receipts;
CREATE POLICY "Authenticated users can update receipts" ON public.money_receipts FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Super Admins can delete receipts" ON public.money_receipts;
CREATE POLICY "Super Admins can delete receipts" ON public.money_receipts FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated users can read receipt items" ON public.receipt_items;
CREATE POLICY "Authenticated users can read receipt items" ON public.receipt_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert receipt items" ON public.receipt_items;
CREATE POLICY "Authenticated users can insert receipt items" ON public.receipt_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update receipt items" ON public.receipt_items;
CREATE POLICY "Authenticated users can update receipt items" ON public.receipt_items FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete receipt items" ON public.receipt_items;
CREATE POLICY "Authenticated users can delete receipt items" ON public.receipt_items FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read activities" ON public.activities;
CREATE POLICY "Authenticated users can read activities" ON public.activities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.activities;
CREATE POLICY "Authenticated users can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);

-- ====================================================================
-- 4. DATABASE TRIGGERS & AUTO FUNCTIONS
-- ====================================================================

-- --------------------------------------------------------------------
-- 4.1 Auto Profile Creation on Signup (First User = Super Admin)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INT;
  assigned_role TEXT;
  user_name TEXT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN
    assigned_role := 'super_admin';
  ELSE
    assigned_role := 'user';
  END IF;

  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    assigned_role,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------
-- 4.2 Auto Timestamp Updates
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_settings_updated_at ON public.business_settings;
CREATE TRIGGER tr_settings_updated_at BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_customers_updated_at ON public.customers;
CREATE TRIGGER tr_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_invoices_updated_at ON public.invoices;
CREATE TRIGGER tr_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_receipts_updated_at ON public.money_receipts;
CREATE TRIGGER tr_receipts_updated_at BEFORE UPDATE ON public.money_receipts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- --------------------------------------------------------------------
-- 4.3 Sequential Number Generators (Safe & Persistent)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_invoice_number()
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_seq INT;
  v_year TEXT;
  v_result TEXT;
BEGIN
  SELECT invoice_prefix, invoice_sequence
  INTO v_prefix, v_seq
  FROM public.business_settings
  LIMIT 1
  FOR UPDATE;

  IF v_prefix IS NULL THEN v_prefix := 'INV'; END IF;
  IF v_seq IS NULL THEN v_seq := 1; END IF;

  v_year := to_char(CURRENT_DATE, 'YYYY');
  v_result := v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 6, '0');

  UPDATE public.business_settings
  SET invoice_sequence = v_seq + 1;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_next_receipt_number()
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_seq INT;
  v_ym TEXT;
  v_result TEXT;
BEGIN
  SELECT receipt_prefix, receipt_sequence
  INTO v_prefix, v_seq
  FROM public.business_settings
  LIMIT 1
  FOR UPDATE;

  IF v_prefix IS NULL THEN v_prefix := 'INF'; END IF;
  IF v_seq IS NULL THEN v_seq := 1; END IF;

  v_ym := to_char(CURRENT_DATE, 'YYYYMM');
  v_result := v_prefix || '-' || v_ym || '-' || lpad(v_seq::text, 4, '0');

  UPDATE public.business_settings
  SET receipt_sequence = v_seq + 1;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 5. INITIAL SEEDING FOR BUSINESS SETTINGS
-- ====================================================================
INSERT INTO public.business_settings (
  company_name,
  tagline,
  address,
  phone,
  email,
  website,
  currency,
  invoice_prefix,
  receipt_prefix
)
SELECT
  'INFORMIX BD',
  'Security & Surveillance Solutions',
  'Dhaka, Bangladesh',
  '+880 1XXXXXXXXX',
  'info@informixbd.com',
  'www.informixbd.com',
  '৳',
  'INV',
  'INF'
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings);

-- ====================================================================
-- 6. STORAGE BUCKET (For Business Logo & Media)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Access for Business Assets" ON storage.objects;
CREATE POLICY "Public Read Access for Business Assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-assets');

DROP POLICY IF EXISTS "Authenticated Users Can Upload Business Assets" ON storage.objects;
CREATE POLICY "Authenticated Users Can Upload Business Assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'business-assets');

DROP POLICY IF EXISTS "Super Admins Can Delete Business Assets" ON storage.objects;
CREATE POLICY "Super Admins Can Delete Business Assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'business-assets' AND public.is_super_admin());

-- ====================================================================
-- 7. QUOTATIONS MODULE (QUOTATIONS, ITEMS, RELATIONSHIPS, RLS, FUNCTIONS)
-- ====================================================================

-- 7.1 Add quotation prefix and sequence to business_settings
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS quotation_prefix TEXT NOT NULL DEFAULT 'QT';

ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS quotation_sequence INT NOT NULL DEFAULT 1;

-- 7.2 Create Quotations Table
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

-- 7.3 Create Quotation Items Table (Cascade Delete with Quotation)
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

-- 7.4 Add source_quotation_id to invoices for bidirectional relationship
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS source_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_source_quotation ON public.invoices(source_quotation_id);

-- 7.5 Auto Updated_at Trigger for Quotations
DROP TRIGGER IF EXISTS tr_quotations_updated_at ON public.quotations;
CREATE TRIGGER tr_quotations_updated_at 
BEFORE UPDATE ON public.quotations 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7.6 Sequential Quotation Number Generator Function
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

-- 7.7 Atomic Quotation-to-Invoice Conversion Function
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

-- 7.8 Row Level Security Policies
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

