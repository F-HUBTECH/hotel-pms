-- =============================================
-- Hotel PMS - Schema V8: Billing Folio (KFO Parity)
-- Run AFTER schema_v4_accounting.sql
-- Adds: revenue_transaction_codes, billing_addresses,
--       folio_seq (4 folios/reservation), VAT/SC fields,
--       folio lock, folio_setup (billing instructions),
--       folio_payments (explicit), credit note support
-- =============================================

-- =============================================
-- 1. REVENUE TRANSACTION CODES
--    (KFO: revenuetrancode table)
--    Maps charge codes → description, VAT type, GL account
-- =============================================
CREATE TABLE IF NOT EXISTS public.revenue_transaction_codes (
  id                 UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  code               TEXT    NOT NULL UNIQUE,
  description        TEXT    NOT NULL,
  gl_account_code    TEXT    REFERENCES public.chart_of_accounts(account_code) ON DELETE SET NULL,
  department_id      UUID    REFERENCES public.departments(id) ON DELETE SET NULL,

  -- VAT / Tax settings
  vat_type           TEXT    NOT NULL DEFAULT 'V'
                             CHECK (vat_type IN ('V','N','E')),
                             -- V = Vatable (VAT inclusive or exclusive)
                             -- N = Non-VAT
                             -- E = Exempt
  vat_inclusive      BOOLEAN NOT NULL DEFAULT true,
                             -- true  = amount already includes VAT (Thailand standard)
                             -- false = VAT added on top of amount
  default_vat_rate   NUMERIC(5,2) NOT NULL DEFAULT 7.00,   -- %
  default_serv_rate  NUMERIC(5,2) NOT NULL DEFAULT 10.00,  -- % service charge

  -- Posting rules
  allow_manual_post  BOOLEAN NOT NULL DEFAULT true,
  is_rebate          BOOLEAN NOT NULL DEFAULT false,  -- rebate requires remark
  is_payment_code    BOOLEAN NOT NULL DEFAULT false,  -- true = payment type (negative)
  is_advance_payment BOOLEAN NOT NULL DEFAULT false,
  default_folio_seq  INT     NOT NULL DEFAULT 1 CHECK (default_folio_seq BETWEEN 1 AND 4),

  -- Display
  sort_order         INT     NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default transaction codes (mirrors KFO revenuetrancode seed data)
INSERT INTO public.revenue_transaction_codes
  (code, description, vat_type, vat_inclusive, default_vat_rate, default_serv_rate,
   is_payment_code, is_rebate, allow_manual_post, default_folio_seq, sort_order)
VALUES
  -- Room charges
  ('ROOM',    'Room Charge',              'V', true,  7.00, 10.00, false, false, false, 1, 10),
  ('EXBED',   'Extra Bed',                'V', true,  7.00, 10.00, false, false, true,  1, 11),
  ('BREAK',   'Breakfast',                'V', true,  7.00, 10.00, false, false, true,  1, 20),
  ('LUNCH',   'Lunch',                    'V', true,  7.00, 10.00, false, false, true,  1, 21),
  ('DINNER',  'Dinner',                   'V', true,  7.00, 10.00, false, false, true,  1, 22),
  ('MINIBAR', 'Mini Bar',                 'V', true,  7.00, 10.00, false, false, true,  1, 30),
  ('LAUNDRY', 'Laundry',                  'V', true,  7.00, 10.00, false, false, true,  1, 31),
  ('PHONE',   'Telephone',                'V', true,  7.00,  0.00, false, false, true,  1, 32),
  ('INET',    'Internet / Wi-Fi',         'V', true,  7.00,  0.00, false, false, true,  1, 33),
  ('PARK',    'Parking',                  'V', true,  7.00,  0.00, false, false, true,  1, 34),
  ('SPA',     'Spa & Wellness',           'V', true,  7.00, 10.00, false, false, true,  1, 35),
  ('MISC',    'Miscellaneous Charge',     'V', true,  7.00,  0.00, false, false, true,  1, 40),
  ('DAMAGE',  'Damage Charge',            'V', true,  7.00,  0.00, false, false, true,  1, 41),
  -- Non-VAT
  ('LATEOUT', 'Late Check-out',           'N', true,  0.00,  0.00, false, false, true,  1, 50),
  ('EARLYIN', 'Early Check-in',           'N', true,  0.00,  0.00, false, false, true,  1, 51),
  -- Rebates / Adjustments
  ('REBATE',  'Rebate / Adjustment',      'V', true,  7.00,  0.00, false, true,  true,  1, 60),
  ('DISC',    'Discount',                 'N', true,  0.00,  0.00, false, true,  true,  1, 61),
  -- Payments (is_payment_code = true → amount stored as negative)
  ('CASH',    'Cash Payment',             'N', true,  0.00,  0.00, true,  false, false, 1, 100),
  ('VISA',    'Visa Card',                'N', true,  0.00,  0.00, true,  false, false, 1, 101),
  ('MCARD',   'Master Card',              'N', true,  0.00,  0.00, true,  false, false, 1, 102),
  ('AMEX',    'American Express',         'N', true,  0.00,  0.00, true,  false, false, 1, 103),
  ('JCB',     'JCB Card',                 'N', true,  0.00,  0.00, true,  false, false, 1, 104),
  ('BKTRF',   'Bank Transfer',            'N', true,  0.00,  0.00, true,  false, false, 1, 105),
  ('CHQUE',   'Cheque',                   'N', true,  0.00,  0.00, true,  false, false, 1, 106),
  ('ONLINE',  'Online Payment',           'N', true,  0.00,  0.00, true,  false, false, 1, 107),
  ('DEPST',   'Advance Deposit',          'N', true,  0.00,  0.00, true,  false, false, 1, 108),
  ('AR',      'City Ledger / AR',         'N', true,  0.00,  0.00, true,  false, true,  1, 109)
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 2. BILLING ADDRESSES
--    (KFO: Billaddress.pas — ที่อยู่ใบเสร็จ/ใบกำกับภาษี)
-- =============================================
CREATE TABLE IF NOT EXISTS public.billing_addresses (
  id              UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  UUID  REFERENCES public.reservations(id) ON DELETE CASCADE,
  -- Bill To fields
  company_name    TEXT  NOT NULL DEFAULT '',
  attn_name       TEXT  NOT NULL DEFAULT '',   -- Attention / ผู้ติดต่อ
  address_line1   TEXT  NOT NULL DEFAULT '',
  address_line2   TEXT  NOT NULL DEFAULT '',
  address_line3   TEXT  NOT NULL DEFAULT '',
  city            TEXT  NOT NULL DEFAULT '',
  country         TEXT  NOT NULL DEFAULT '',
  tax_id          TEXT  NOT NULL DEFAULT '',   -- เลขผู้เสียภาษี
  phone           TEXT  NOT NULL DEFAULT '',
  email           TEXT  NOT NULL DEFAULT '',
  -- Reference / PO number
  reference_no    TEXT  NOT NULL DEFAULT '',
  created_by      UUID  REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_addresses_reservation
  ON public.billing_addresses(reservation_id);

-- =============================================
-- 3. FOLIO_SETUP (Billing Instructions)
--    (KFO: foliosetupdetail + foliosetupmaster)
--    Rules: which tran_code goes to which folio_seq
--           with optional limit amount and effective date
-- =============================================
CREATE TABLE IF NOT EXISTS public.folio_setup (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  UUID    NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  tran_code       TEXT    NOT NULL REFERENCES public.revenue_transaction_codes(code) ON DELETE CASCADE,
  folio_seq       INT     NOT NULL DEFAULT 1 CHECK (folio_seq BETWEEN 1 AND 4),
  limit_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,   -- 0 = no limit
  until_date      DATE,                               -- NULL = until check-out
  sort_order      INT     NOT NULL DEFAULT 0,
  created_by      UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folio_setup_reservation
  ON public.folio_setup(reservation_id);
CREATE INDEX IF NOT EXISTS idx_folio_setup_tran_code
  ON public.folio_setup(tran_code);

-- =============================================
-- 4. ALTER FOLIOS — add folio_seq (1-4), lock fields
--    (KFO: Folio 1, Folio 2, Folio 3, Folio 4 per guest)
-- =============================================

-- Add folio_seq: which folio number (1-4) for this reservation
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS folio_seq        INT         NOT NULL DEFAULT 1
      CHECK (folio_seq BETWEEN 1 AND 4);

-- Add lock support (KFO: block/unblock folio)
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS is_locked        BOOLEAN     NOT NULL DEFAULT false;
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS locked_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS locked_at        TIMESTAMPTZ;

-- Link to billing address for this specific folio
ALTER TABLE public.folios
  ADD COLUMN IF NOT EXISTS billing_address_id UUID
      REFERENCES public.billing_addresses(id) ON DELETE SET NULL;

-- Unique constraint: one folio per (reservation_id, folio_seq)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'folios_reservation_folio_seq_key'
  ) THEN
    ALTER TABLE public.folios
      ADD CONSTRAINT folios_reservation_folio_seq_key
      UNIQUE (reservation_id, folio_seq);
  END IF;
END $$;

-- =============================================
-- 5. ALTER FOLIO_ITEMS — add VAT, service charge,
--    shift, credit note, reference, payf flag
--    (KFO: billtransaction columns)
-- =============================================

-- Transaction code reference
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS tran_code        TEXT
      REFERENCES public.revenue_transaction_codes(code) ON DELETE SET NULL;

-- VAT / Service Charge breakdown
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS vat_type         TEXT        NOT NULL DEFAULT 'V'
      CHECK (vat_type IN ('V','N','E'));
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS vat_rate         NUMERIC(5,2)  NOT NULL DEFAULT 0;
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS vat_amount       NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS service_rate     NUMERIC(5,2)  NOT NULL DEFAULT 0;
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS service_amount   NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS vatable_amount   NUMERIC(10,2) NOT NULL DEFAULT 0;  -- vat-able portion of amount
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS non_vat_amount   NUMERIC(10,2) NOT NULL DEFAULT 0;  -- non-vat portion

-- Original amount (before any correction)
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS org_amount       NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Payment/Status flag (KFO: PAYF field)
--   '' or 'I' = normal item
--   'P' = paid (marked when check-out)
--   'C' = credit note issued
--   'W' = voided
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS payf             TEXT        NOT NULL DEFAULT ''
      CHECK (payf IN ('', 'I', 'P', 'C', 'W'));

-- Audit / Shift tracking (KFO: audituser, auditshift, SHIFTCODE)
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS shift_code       TEXT        NOT NULL DEFAULT '';
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS posted_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Credit Note reference (KFO: CRNOTE field)
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS credit_note_no   INT         NOT NULL DEFAULT 0;
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS credit_note_ref  INT         NOT NULL DEFAULT 0;   -- original tranno if this is a CR

-- Tax Invoice
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS tax_inv_no       INT         NOT NULL DEFAULT 0;

-- Reference / Remark fields (KFO: REFERENCE, REMARK, PAYREMARK1/2/3)
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS reference        TEXT        NOT NULL DEFAULT '';
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS remark           TEXT        NOT NULL DEFAULT '';
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS pay_remark1      TEXT        NOT NULL DEFAULT '';
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS pay_remark2      TEXT        NOT NULL DEFAULT '';
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS pay_remark3      TEXT        NOT NULL DEFAULT '';

-- Auto-post date (KFO: AUTOPOST_DATE — for night audit room charge)
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS auto_post_date   DATE;

-- Advance payment flag
ALTER TABLE public.folio_items
  ADD COLUMN IF NOT EXISTS is_advance_payment BOOLEAN NOT NULL DEFAULT false;

-- =============================================
-- 6. FOLIO_PAYMENTS TABLE (explicit, if not exists)
--    (KFO: payment info stored in billtransaction with is_payment_code)
--    We keep a separate table for cleaner reporting
-- =============================================
CREATE TABLE IF NOT EXISTS public.folio_payments (
  id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio_id         UUID    NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  tran_code        TEXT    REFERENCES public.revenue_transaction_codes(code) ON DELETE SET NULL,
  payment_method   TEXT    NOT NULL DEFAULT 'cash',
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reference_number TEXT    NOT NULL DEFAULT '',
  notes            TEXT    NOT NULL DEFAULT '',
  pay_remark1      TEXT    NOT NULL DEFAULT '',
  pay_remark2      TEXT    NOT NULL DEFAULT '',
  pay_remark3      TEXT    NOT NULL DEFAULT '',
  -- Credit Card extra fields
  card_type        TEXT    NOT NULL DEFAULT '',
  card_number_last4 TEXT   NOT NULL DEFAULT '',
  approval_code    TEXT    NOT NULL DEFAULT '',
  -- Shift tracking
  shift_code       TEXT    NOT NULL DEFAULT '',
  -- Status
  is_voided        BOOLEAN NOT NULL DEFAULT false,
  void_reason      TEXT,
  voided_at        TIMESTAMPTZ,
  voided_by        UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Audit
  created_by       UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folio_payments_folio_id
  ON public.folio_payments(folio_id);

-- =============================================
-- 7. TAX INVOICES TABLE
--    (KFO: TAX_INV, INV_NO — ใบกำกับภาษี)
-- =============================================
CREATE TABLE IF NOT EXISTS public.tax_invoices (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number  BIGINT  NOT NULL UNIQUE,            -- sequential number
  folio_id        UUID    NOT NULL REFERENCES public.folios(id) ON DELETE RESTRICT,
  reservation_id  UUID    REFERENCES public.reservations(id) ON DELETE SET NULL,
  issue_date      DATE    NOT NULL DEFAULT CURRENT_DATE,
  -- Bill To (snapshot at time of issue)
  company_name    TEXT    NOT NULL DEFAULT '',
  tax_id          TEXT    NOT NULL DEFAULT '',
  address         TEXT    NOT NULL DEFAULT '',
  -- Amounts
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,   -- before VAT
  vat_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  service_charge  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Credit Note link
  is_credit_note  BOOLEAN NOT NULL DEFAULT false,
  original_inv_id UUID    REFERENCES public.tax_invoices(id) ON DELETE SET NULL,
  -- Audit
  issued_by       UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  printed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-increment tax invoice number
CREATE SEQUENCE IF NOT EXISTS tax_invoice_seq START WITH 100001;

CREATE OR REPLACE FUNCTION public.generate_tax_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = 0 THEN
    NEW.invoice_number := nextval('tax_invoice_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tax_invoice_number ON public.tax_invoices;
CREATE TRIGGER set_tax_invoice_number
  BEFORE INSERT ON public.tax_invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_tax_invoice_number();

CREATE INDEX IF NOT EXISTS idx_tax_invoices_folio_id
  ON public.tax_invoices(folio_id);

-- =============================================
-- 8. HELPER FUNCTION: Get or Create 4 Folios
--    Creates folio_seq 1-4 for a reservation on demand
--    Returns all 4 folio rows
-- =============================================
CREATE OR REPLACE FUNCTION public.get_or_create_reservation_folios(
  p_reservation_id UUID
)
RETURNS SETOF public.folios AS $$
DECLARE
  seq INT;
BEGIN
  -- Ensure folio 1 always exists (created at check-in by existing logic)
  -- Create folios 1-4 if any are missing
  FOR seq IN 1..4 LOOP
    INSERT INTO public.folios (reservation_id, folio_seq, status, total_amount, paid_amount, balance)
    VALUES (p_reservation_id, seq, 'open', 0, 0, 0)
    ON CONFLICT (reservation_id, folio_seq) DO NOTHING;
  END LOOP;

  RETURN QUERY
    SELECT * FROM public.folios
    WHERE reservation_id = p_reservation_id
    ORDER BY folio_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 9. HELPER FUNCTION: Recalculate Folio Totals
--    Triggered after folio_items or folio_payments change
-- =============================================
CREATE OR REPLACE FUNCTION public.recalculate_folio_totals(p_folio_id UUID)
RETURNS VOID AS $$
DECLARE
  v_charges     NUMERIC(10,2) := 0;
  v_vat         NUMERIC(10,2) := 0;
  v_service     NUMERIC(10,2) := 0;
  v_paid        NUMERIC(10,2) := 0;
BEGIN
  -- Sum active (non-voided) charges
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(vat_amount), 0),
    COALESCE(SUM(service_amount), 0)
  INTO v_charges, v_vat, v_service
  FROM public.folio_items
  WHERE folio_id = p_folio_id
    AND is_voided = false
    AND payf NOT IN ('W');

  -- Sum active (non-voided) payments
  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM public.folio_payments
  WHERE folio_id = p_folio_id
    AND is_voided = false;

  UPDATE public.folios
  SET
    total_amount   = v_charges,
    tax_amount     = v_vat,
    service_charge = v_service,
    paid_amount    = v_paid,
    balance        = v_charges - v_paid,
    updated_at     = NOW()
  WHERE id = p_folio_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 10. TRIGGERS: Auto-recalculate on folio_items change
-- =============================================
CREATE OR REPLACE FUNCTION public.trg_recalc_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_folio_totals(OLD.folio_id);
  ELSE
    PERFORM public.recalculate_folio_totals(NEW.folio_id);
    -- If item moved between folios, recalc both
    IF TG_OP = 'UPDATE' AND OLD.folio_id <> NEW.folio_id THEN
      PERFORM public.recalculate_folio_totals(OLD.folio_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_folio_items_recalc ON public.folio_items;
CREATE TRIGGER trg_folio_items_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.folio_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_on_item_change();

-- Trigger on payments
CREATE OR REPLACE FUNCTION public.trg_recalc_on_payment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_folio_totals(OLD.folio_id);
  ELSE
    PERFORM public.recalculate_folio_totals(NEW.folio_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_folio_payments_recalc ON public.folio_payments;
CREATE TRIGGER trg_folio_payments_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.folio_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_on_payment_change();

-- =============================================
-- 11. RPC: Post Transaction with VAT Calculation
--     Replaces simple folio_items insert
--     Calculates VAT/SC from transaction code defaults
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_post_folio_item(
  p_folio_id          UUID,
  p_tran_code         TEXT,
  p_description       TEXT,
  p_amount            NUMERIC,    -- gross amount (VAT inclusive if vat_inclusive=true)
  p_quantity          INT         DEFAULT 1,
  p_item_date         DATE        DEFAULT CURRENT_DATE,
  p_reference         TEXT        DEFAULT '',
  p_remark            TEXT        DEFAULT '',
  p_folio_group_id    UUID        DEFAULT NULL,
  p_user_id           UUID        DEFAULT NULL,
  p_shift_code        TEXT        DEFAULT '',
  p_override_vat_rate NUMERIC     DEFAULT NULL,  -- NULL = use tran_code default
  p_override_sc_rate  NUMERIC     DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_item_id       UUID;
  v_tc            public.revenue_transaction_codes%ROWTYPE;
  v_vat_rate      NUMERIC(5,2)  := 0;
  v_serv_rate     NUMERIC(5,2)  := 0;
  v_gross         NUMERIC(10,2);
  v_net           NUMERIC(10,2);
  v_vat_amt       NUMERIC(10,2) := 0;
  v_serv_amt      NUMERIC(10,2) := 0;
  v_vatable_amt   NUMERIC(10,2) := 0;
  v_non_vat_amt   NUMERIC(10,2) := 0;
BEGIN
  -- Fetch transaction code defaults
  SELECT * INTO v_tc
  FROM public.revenue_transaction_codes
  WHERE code = p_tran_code AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction code % not found or inactive', p_tran_code;
  END IF;

  IF NOT v_tc.allow_manual_post AND p_shift_code = '' THEN
    RAISE EXCEPTION 'Transaction code % does not allow manual posting', p_tran_code;
  END IF;

  -- Resolve rates
  v_vat_rate  := COALESCE(p_override_vat_rate,  v_tc.default_vat_rate);
  v_serv_rate := COALESCE(p_override_sc_rate,   v_tc.default_serv_rate);
  v_gross     := p_amount * p_quantity;

  -- Calculate VAT and Service Charge
  IF v_tc.vat_type = 'V' THEN
    IF v_tc.vat_inclusive THEN
      -- VAT is included in gross amount (Thailand standard)
      -- SC is also calculated from pre-VAT amount
      -- Formula: net_before_vat = gross / (1 + vat_rate/100)
      -- But typically in Thai hotels: gross already includes both SC and VAT
      -- Simple approach: extract VAT from gross amount
      v_vat_amt     := ROUND(v_gross * v_vat_rate / (100 + v_vat_rate), 2);
      v_serv_amt    := ROUND(v_gross * v_serv_rate / (100 + v_vat_rate + v_serv_rate), 2);
      v_vatable_amt := v_gross;
      v_non_vat_amt := 0;
    ELSE
      -- VAT added on top
      v_net        := v_gross;
      v_serv_amt   := ROUND(v_net * v_serv_rate / 100, 2);
      v_vat_amt    := ROUND((v_net + v_serv_amt) * v_vat_rate / 100, 2);
      v_vatable_amt := v_gross;
      v_non_vat_amt := 0;
    END IF;
  ELSIF v_tc.vat_type = 'N' THEN
    -- Non-VAT item
    v_vat_amt     := 0;
    v_serv_amt    := 0;
    v_vatable_amt := 0;
    v_non_vat_amt := v_gross;
  ELSE
    -- Exempt
    v_vat_amt     := 0;
    v_serv_amt    := 0;
    v_vatable_amt := 0;
    v_non_vat_amt := 0;
  END IF;

  -- Insert folio item
  INSERT INTO public.folio_items (
    folio_id, tran_code, description, amount, org_amount,
    item_date, quantity, unit_price,
    folio_group_id,
    vat_type, vat_rate, vat_amount,
    service_rate, service_amount,
    vatable_amount, non_vat_amount,
    reference, remark,
    shift_code, posted_by,
    is_voided, payf
  ) VALUES (
    p_folio_id, p_tran_code, p_description, v_gross, v_gross,
    p_item_date, p_quantity, p_amount,
    p_folio_group_id,
    v_tc.vat_type, v_vat_rate, v_vat_amt,
    v_serv_rate, v_serv_amt,
    v_vatable_amt, v_non_vat_amt,
    p_reference, p_remark,
    p_shift_code, p_user_id,
    false, 'I'
  ) RETURNING id INTO v_item_id;

  RETURN v_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 12. RPC: Receive Payment (stores to folio_payments)
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_receive_folio_payment(
  p_folio_id        UUID,
  p_tran_code       TEXT        DEFAULT 'CASH',
  p_payment_method  TEXT        DEFAULT 'cash',
  p_amount          NUMERIC,
  p_reference       TEXT        DEFAULT '',
  p_notes           TEXT        DEFAULT '',
  p_pay_remark1     TEXT        DEFAULT '',
  p_pay_remark2     TEXT        DEFAULT '',
  p_pay_remark3     TEXT        DEFAULT '',
  p_card_type       TEXT        DEFAULT '',
  p_card_last4      TEXT        DEFAULT '',
  p_approval_code   TEXT        DEFAULT '',
  p_shift_code      TEXT        DEFAULT '',
  p_user_id         UUID        DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  -- Check folio is not locked
  IF EXISTS (SELECT 1 FROM public.folios WHERE id = p_folio_id AND is_locked = true) THEN
    RAISE EXCEPTION 'Folio is locked. Unlock folio before receiving payment.';
  END IF;

  INSERT INTO public.folio_payments (
    folio_id, tran_code, payment_method, amount,
    reference_number, notes,
    pay_remark1, pay_remark2, pay_remark3,
    card_type, card_number_last4, approval_code,
    shift_code, created_by
  ) VALUES (
    p_folio_id, p_tran_code, p_payment_method, p_amount,
    p_reference, p_notes,
    p_pay_remark1, p_pay_remark2, p_pay_remark3,
    p_card_type, p_card_last4, p_approval_code,
    p_shift_code, p_user_id
  ) RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 13. RPC: Void Folio Item
--     Sets is_voided=true, payf='W', records reason
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_void_folio_item(
  p_item_id    UUID,
  p_reason     TEXT,
  p_user_id    UUID  DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_folio_id UUID;
BEGIN
  SELECT folio_id INTO v_folio_id
  FROM public.folio_items WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folio item % not found', p_item_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.folios WHERE id = v_folio_id AND is_locked = true
  ) THEN
    RAISE EXCEPTION 'Folio is locked. Cannot void items.';
  END IF;

  UPDATE public.folio_items
  SET
    is_voided   = true,
    payf        = 'W',
    void_reason = p_reason,
    voided_at   = NOW(),
    voided_by   = p_user_id
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 14. RPC: Issue Credit Note
--     Reverses a transaction by posting a negative copy
--     Sets original item payf='C', stores credit_note_no
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_issue_credit_note(
  p_original_item_id  UUID,
  p_reason            TEXT    DEFAULT '',
  p_user_id           UUID    DEFAULT NULL,
  p_shift_code        TEXT    DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
  v_orig          public.folio_items%ROWTYPE;
  v_cr_no         INT;
  v_new_item_id   UUID;
BEGIN
  SELECT * INTO v_orig FROM public.folio_items WHERE id = p_original_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original folio item % not found', p_original_item_id;
  END IF;
  IF v_orig.payf = 'C' THEN
    RAISE EXCEPTION 'Credit note already issued for this item';
  END IF;
  IF v_orig.is_voided THEN
    RAISE EXCEPTION 'Cannot issue credit note for a voided item';
  END IF;

  -- Generate sequential credit note number
  SELECT COALESCE(MAX(credit_note_no), 0) + 1 INTO v_cr_no
  FROM public.folio_items;

  -- Mark original as 'C' (credit noted)
  UPDATE public.folio_items
  SET payf = 'C', credit_note_no = v_cr_no
  WHERE id = p_original_item_id;

  -- Insert reversal item (negative amount)
  INSERT INTO public.folio_items (
    folio_id, tran_code, description, amount, org_amount,
    item_date, quantity, unit_price,
    folio_group_id,
    vat_type, vat_rate, vat_amount,
    service_rate, service_amount,
    vatable_amount, non_vat_amount,
    reference, remark,
    shift_code, posted_by,
    credit_note_no, credit_note_ref,
    is_voided, payf
  )
  SELECT
    v_orig.folio_id,
    v_orig.tran_code,
    'CR.' || v_cr_no || ' ' || v_orig.description,
    v_orig.amount * -1,
    v_orig.org_amount * -1,
    CURRENT_DATE, v_orig.quantity, v_orig.unit_price,
    v_orig.folio_group_id,
    v_orig.vat_type, v_orig.vat_rate, v_orig.vat_amount * -1,
    v_orig.service_rate, v_orig.service_amount * -1,
    v_orig.vatable_amount * -1, v_orig.non_vat_amount * -1,
    COALESCE(p_reason, ''), p_reason,
    p_shift_code, p_user_id,
    v_cr_no, v_orig.credit_note_no,
    false, 'C'
  RETURNING id INTO v_new_item_id;

  RETURN v_new_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 15. RPC: Lock / Unlock Folio
--     (KFO: Block/Unblock folio)
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_lock_folio(
  p_folio_id  UUID,
  p_lock      BOOLEAN,
  p_user_id   UUID  DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.folios
  SET
    is_locked  = p_lock,
    locked_by  = CASE WHEN p_lock THEN p_user_id ELSE NULL END,
    locked_at  = CASE WHEN p_lock THEN NOW()     ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_folio_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 16. RPC: Transfer Items Between Folios
--     Moves selected folio_items to another folio
--     (same reservation or different, incl. cross-room)
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_transfer_folio_items(
  p_item_ids        UUID[],
  p_target_folio_id UUID,
  p_user_id         UUID  DEFAULT NULL,
  p_remark          TEXT  DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_moved     INT := 0;
  v_item_id   UUID;
  v_src_folio UUID;
  v_item_data RECORD;
BEGIN
  -- Validate target folio exists and is open
  IF NOT EXISTS (
    SELECT 1 FROM public.folios
    WHERE id = p_target_folio_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Target folio not found or not open';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.folios WHERE id = p_target_folio_id AND is_locked = true
  ) THEN
    RAISE EXCEPTION 'Target folio is locked';
  END IF;

  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    SELECT folio_id, tran_code, description, amount, item_date INTO v_item_data
    FROM public.folio_items
    WHERE id = v_item_id AND is_voided = false AND payf NOT IN ('W','P');

    IF FOUND AND v_item_data.folio_id <> p_target_folio_id THEN
      v_src_folio := v_item_data.folio_id;
      
      -- Log the transfer before updating
      INSERT INTO public.folio_transfer_logs (
        item_id, source_folio_id, target_folio_id,
        tran_code, description, amount, tran_date,
        transferred_by, remark, transfer_type
      ) VALUES (
        v_item_id, v_src_folio, p_target_folio_id,
        v_item_data.tran_code, v_item_data.description, 
        v_item_data.amount, v_item_data.item_date,
        p_user_id, p_remark, 'folio'
      );

      -- Update the item's folio
      UPDATE public.folio_items
      SET folio_id = p_target_folio_id
      WHERE id = v_item_id;

      v_moved := v_moved + 1;
    END IF;
  END LOOP;

  RETURN v_moved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 17. VIEW: Cashier Folio Summary
--     Quick overview per guest/reservation
-- =============================================
CREATE OR REPLACE VIEW public.v_cashier_folio_summary AS
SELECT
  f.id,
  f.reservation_id,
  f.folio_seq,
  f.folio_number,
  f.status,
  f.is_locked,
  f.total_amount,
  f.paid_amount,
  f.tax_amount,
  f.service_charge,
  f.balance,
  f.created_at,
  -- Reservation info
  r.reservation_number,
  r.check_in_date,
  r.check_out_date,
  r.status      AS reservation_status,
  -- Guest info
  g.id          AS guest_id,
  g.first_name,
  g.last_name,
  g.first_name || ' ' || g.last_name AS full_name,
  -- Room info
  rm.room_number
FROM public.folios f
JOIN public.reservations  r  ON r.id  = f.reservation_id
JOIN public.guests         g  ON g.id  = r.guest_id
LEFT JOIN public.rooms     rm ON rm.id = r.room_id
WHERE f.deleted_at IS NULL;

-- =============================================
-- 18. RLS POLICIES for new tables
-- =============================================
ALTER TABLE public.revenue_transaction_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view tran_codes"
  ON public.revenue_transaction_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage tran_codes"
  ON public.revenue_transaction_codes FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('super_admin','admin','manager'))
  );

ALTER TABLE public.billing_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage billing_addresses"
  ON public.billing_addresses FOR ALL TO authenticated USING (true);

ALTER TABLE public.folio_setup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage folio_setup"
  ON public.folio_setup FOR ALL TO authenticated USING (true);

ALTER TABLE public.folio_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view folio_payments"
  ON public.folio_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert folio_payments"
  ON public.folio_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update folio_payments"
  ON public.folio_payments FOR UPDATE TO authenticated USING (true);

ALTER TABLE public.tax_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view tax_invoices"
  ON public.tax_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert tax_invoices"
  ON public.tax_invoices FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- 19. INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_folio_items_tran_code
  ON public.folio_items(tran_code);
CREATE INDEX IF NOT EXISTS idx_folio_items_payf
  ON public.folio_items(payf);
CREATE INDEX IF NOT EXISTS idx_folio_items_item_date
  ON public.folio_items(item_date);
CREATE INDEX IF NOT EXISTS idx_folios_folio_seq
  ON public.folios(reservation_id, folio_seq);
CREATE INDEX IF NOT EXISTS idx_folios_is_locked
  ON public.folios(is_locked);

-- =============================================
-- Done: Schema V8 Billing Folio
-- =============================================
