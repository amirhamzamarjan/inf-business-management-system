-- ====================================================================
-- INFORMIX BD — COMPANY PAD SYSTEM MIGRATION (ADDITIVE & NON-DESTRUCTIVE)
-- Official Corporate Letterheads & Documents Management
-- Multi-User, Role-Based Access Control, Real-Time Business Records
-- ====================================================================

-- 1. Add pad prefix and sequence to business_settings (Additive)
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS pad_prefix TEXT NOT NULL DEFAULT 'PAD';

ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS pad_sequence INT NOT NULL DEFAULT 1;

-- 2. Create Company Pads Table
CREATE TABLE IF NOT EXISTS public.company_pads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pad_number TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  reference_no TEXT,
  recipient_name TEXT,
  recipient_address TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Final', 'Official Notice', 'Issued')),
  signatory_name TEXT,
  signatory_title TEXT,
  include_sign_block BOOLEAN NOT NULL DEFAULT true,
  prepared_by_name TEXT,
  prepared_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_company_pads_number ON public.company_pads(pad_number);
CREATE INDEX IF NOT EXISTS idx_company_pads_date ON public.company_pads(date);
CREATE INDEX IF NOT EXISTS idx_company_pads_status ON public.company_pads(status);
CREATE INDEX IF NOT EXISTS idx_company_pads_topic ON public.company_pads(topic);

-- 3. Auto Updated_at Trigger for Company Pads
DROP TRIGGER IF EXISTS tr_company_pads_updated_at ON public.company_pads;
CREATE TRIGGER tr_company_pads_updated_at 
BEFORE UPDATE ON public.company_pads 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Sequential Pad Number Generator Function
CREATE OR REPLACE FUNCTION public.get_next_pad_number()
RETURNS TEXT AS $$
DECLARE
  v_settings_id UUID;
  v_prefix TEXT;
  v_seq INT;
  v_year TEXT;
  v_result TEXT;
BEGIN
  SELECT id, pad_prefix, pad_sequence
  INTO v_settings_id, v_prefix, v_seq
  FROM public.business_settings
  LIMIT 1
  FOR UPDATE;

  IF v_prefix IS NULL THEN v_prefix := 'PAD'; END IF;
  IF v_seq IS NULL THEN v_seq := 1; END IF;

  v_year := to_char(CURRENT_DATE, 'YYYY');
  v_result := v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 6, '0');

  IF v_settings_id IS NOT NULL THEN
    UPDATE public.business_settings
    SET pad_sequence = v_seq + 1
    WHERE id = v_settings_id;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Row Level Security Policies
ALTER TABLE public.company_pads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read company pads" ON public.company_pads;
CREATE POLICY "Authenticated users can read company pads" ON public.company_pads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert company pads" ON public.company_pads;
CREATE POLICY "Authenticated users can insert company pads" ON public.company_pads FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update company pads" ON public.company_pads;
CREATE POLICY "Authenticated users can update company pads" ON public.company_pads FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Super Admins can delete company pads" ON public.company_pads;
CREATE POLICY "Super Admins can delete company pads" ON public.company_pads FOR DELETE TO authenticated USING (public.is_super_admin());
