-- =============================================
-- Hotel PMS - Schema V4: Accounting & Forecast
-- Run this AFTER schema_v3.sql
-- =============================================

-- =============================================
-- CHART OF ACCOUNTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'income', 'expense')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert Default GL Accounts
INSERT INTO public.chart_of_accounts (account_code, account_name, type) VALUES
('4000', 'Room Revenue', 'income'),
('4100', 'F&B Revenue', 'income'),
('4200', 'Other Revenue', 'income'),
('2100', 'VAT Payable', 'liability'),
('2200', 'Service Charge Payable', 'liability'),
('1000', 'Cash on Hand', 'asset'),
('1100', 'Credit Card Receivable', 'asset'),
('1200', 'Bank Transfer Receivable', 'asset'),
('1300', 'Guest Ledger (AR)', 'asset')
ON CONFLICT (account_code) DO NOTHING;

-- =============================================
-- PAYMENT METHODS
-- =============================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  accounting_code TEXT NOT NULL REFERENCES public.chart_of_accounts(account_code) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert Default Payment Methods
INSERT INTO public.payment_methods (name, accounting_code) VALUES
('cash', '1000'),
('credit_card', '1100'),
('transfer', '1200')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- FOLIOS (UPDATE EXISTING)
-- =============================================
-- Add new columns to folios
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS folio_number TEXT UNIQUE;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Drop tight constraint on status to add 'void'
ALTER TABLE public.folios DROP CONSTRAINT IF EXISTS folios_status_check;
ALTER TABLE public.folios ADD CONSTRAINT folios_status_check
  CHECK (status IN ('open', 'closed', 'void'));

-- Sequence for folio numbers
CREATE SEQUENCE IF NOT EXISTS folio_number_seq START WITH 1000;

CREATE OR REPLACE FUNCTION public.generate_folio_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folio_number IS NULL OR NEW.folio_number = '' THEN
    NEW.folio_number := 'FOL-' || LPAD(nextval('folio_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_folio_number ON public.folios;
CREATE TRIGGER set_folio_number
  BEFORE INSERT ON public.folios
  FOR EACH ROW EXECUTE FUNCTION public.generate_folio_number();

-- Constraint: Cannot close folio if balance != 0
CREATE OR REPLACE FUNCTION public.check_folio_balance_before_close()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    IF NEW.balance != 0 THEN
      RAISE EXCEPTION 'Cannot close folio. Balance must be exactly 0 (current balance is %).', NEW.balance;
    END IF;
    NEW.closed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_folio_balance ON public.folios;
CREATE TRIGGER enforce_folio_balance
  BEFORE UPDATE ON public.folios
  FOR EACH ROW EXECUTE FUNCTION public.check_folio_balance_before_close();

-- =============================================
-- FOLIO_TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.folio_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio_id UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL 
    CHECK (transaction_type IN ('room_charge', 'service', 'tax', 'payment', 'refund')),
  description TEXT NOT NULL,
  debit NUMERIC(10,2) NOT NULL DEFAULT 0,
  credit NUMERIC(10,2) NOT NULL DEFAULT 0,
  reference_no TEXT DEFAULT '',
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Automatically update folio totals when a transaction is inserted
CREATE OR REPLACE FUNCTION public.update_folio_totals_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.folios 
  SET total_amount = total_amount + CASE WHEN NEW.transaction_type IN ('room_charge', 'service') THEN NEW.debit ELSE 0 END,
      tax_amount = tax_amount + CASE WHEN NEW.transaction_type = 'tax' THEN NEW.debit ELSE 0 END,
      balance = balance + NEW.debit - NEW.credit
  WHERE id = NEW.folio_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_folio_totals ON public.folio_transactions;
CREATE TRIGGER update_folio_totals
  AFTER INSERT ON public.folio_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_folio_totals_on_transaction();

-- =============================================
-- ACCOUNT_POSTINGS (Double Entry Ledger)
-- =============================================
CREATE TABLE IF NOT EXISTS public.account_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio_transaction_id UUID NOT NULL REFERENCES public.folio_transactions(id) ON DELETE CASCADE,
  gl_account_code TEXT NOT NULL REFERENCES public.chart_of_accounts(account_code) ON DELETE RESTRICT,
  debit NUMERIC(10,2) NOT NULL DEFAULT 0,
  credit NUMERIC(10,2) NOT NULL DEFAULT 0,
  posted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- RPC: Post Account Transaction
-- =============================================
-- Helper to safely post a transaction + GL records atomically
CREATE OR REPLACE FUNCTION public.rpc_post_account_transaction(
  p_folio_id UUID,
  p_type TEXT,
  p_desc TEXT,
  p_amount NUMERIC,
  p_user_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_trans_id UUID;
  v_debit NUMERIC := 0;
  v_credit NUMERIC := 0;
  v_gl_debit_code TEXT;
  v_gl_credit_code TEXT;
BEGIN
  -- Determine Debit vs Credit
  IF p_type IN ('room_charge', 'service', 'tax') THEN
    v_debit := p_amount;
    v_gl_debit_code := '1300'; -- Guest Ledger AR
    
    IF p_type = 'room_charge' THEN v_gl_credit_code := '4000'; END IF;
    IF p_type = 'service' THEN v_gl_credit_code := '4100'; END IF; -- Or 4200
    IF p_type = 'tax' THEN v_gl_credit_code := '2100'; END IF;
    
  ELSIF p_type IN ('payment') THEN
    v_credit := p_amount;
    v_gl_credit_code := '1300'; -- Guest Ledger AR
    
    -- Lookup payment method's GL code
    SELECT accounting_code INTO v_gl_debit_code 
    FROM public.payment_methods WHERE name = p_payment_method;
    
    IF v_gl_debit_code IS NULL THEN v_gl_debit_code := '1000'; END IF; -- Default to Cash
  END IF;

  -- 1. Insert Folio Transaction
  INSERT INTO public.folio_transactions (
    folio_id, transaction_type, description, debit, credit, posted_by
  ) VALUES (
    p_folio_id, p_type, p_desc, v_debit, v_credit, p_user_id
  ) RETURNING id INTO v_trans_id;

  -- 2. Insert GL Account Postings (Double Entry)
  -- The Debit entry
  IF v_debit > 0 THEN
    INSERT INTO public.account_postings (folio_transaction_id, gl_account_code, debit, credit)
    VALUES (v_trans_id, v_gl_debit_code, v_debit, 0);
    
    INSERT INTO public.account_postings (folio_transaction_id, gl_account_code, debit, credit)
    VALUES (v_trans_id, v_gl_credit_code, 0, v_debit);
  END IF;
  
  -- The Credit entry (Payments)
  IF v_credit > 0 THEN
    INSERT INTO public.account_postings (folio_transaction_id, gl_account_code, debit, credit)
    VALUES (v_trans_id, v_gl_debit_code, v_credit, 0); -- The Bank/Cash increases (debit)
    
    INSERT INTO public.account_postings (folio_transaction_id, gl_account_code, debit, credit)
    VALUES (v_trans_id, v_gl_credit_code, 0, v_credit); -- The AR decreases (credit)
  END IF;

  RETURN v_trans_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================
-- FORECASTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  total_rooms INT NOT NULL DEFAULT 0,
  expected_occupancy INT NOT NULL DEFAULT 0,
  expected_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  occupancy_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  adr NUMERIC(10,2) NOT NULL DEFAULT 0,
  revpar NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, forecast_date)
);

-- =============================================
-- FORECAST_SUMMARY_VIEW (Matches KFO Logic)
-- Combines booked reservations with historical trends
-- =============================================
CREATE OR REPLACE VIEW public.forecast_summary_view AS
WITH FutureBooks AS (
  SELECT 
    r.property_id,
    d.date as forecast_date,
    COUNT(r.id) as booked_rooms,
    COALESCE(SUM(r.rate), 0) as booked_revenue
  FROM generate_series(CURRENT_DATE, CURRENT_DATE + interval '90 days', '1 day'::interval) d(date)
  LEFT JOIN public.reservations r 
    ON r.check_in_date <= d.date::date AND r.check_out_date > d.date::date AND r.status IN ('reserved', 'checked_in')
  GROUP BY r.property_id, d.date
),
HistoricalAvg AS (
  -- 3 month rolling average
  SELECT 
    property_id,
    AVG(occupied_rooms) as avg_occ_rooms,
    AVG(total_revenue) as avg_daily_revenue
  FROM public.night_audits
  WHERE audit_date >= CURRENT_DATE - interval '90 days'
  GROUP BY property_id
)
SELECT 
  fb.property_id,
  fb.forecast_date,
  (SELECT COUNT(id) FROM public.rooms WHERE property_id = fb.property_id AND status != 'out_of_order') as total_rooms,
  GREATEST(fb.booked_rooms, COALESCE(ha.avg_occ_rooms, 0)) as expected_occupancy,
  GREATEST(fb.booked_revenue, COALESCE(ha.avg_daily_revenue, 0)) as expected_revenue
FROM FutureBooks fb
LEFT JOIN HistoricalAvg ha ON fb.property_id = ha.property_id
WHERE fb.property_id IS NOT NULL;


-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view chart_of_accounts" ON public.chart_of_accounts FOR SELECT TO authenticated USING (true);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view payment_methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);

ALTER TABLE public.folio_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view folio_transactions" ON public.folio_transactions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.account_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view account_postings" ON public.account_postings FOR SELECT TO authenticated USING (true);

ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view forecasts" ON public.forecasts FOR SELECT TO authenticated USING (true);
