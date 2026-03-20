-- =============================================
-- HOTEL PMS - PRODUCTION DEPLOYMENT SCRIPT
-- Run this entire file in Supabase SQL Editor
-- =============================================

-- NOTE: This script assumes base schemas (v1-v7) are already deployed.
-- If NOT, please run base schemas first in this order:
-- 1. schema.sql
-- 2. rls_policies.sql
-- 3. schema_v2.sql through schema_v7_groups.sql

-- =============================================
-- SCHEMA V8: BILLING FOLIO (CORE)
-- =============================================

-- =============================================
-- 1. REVENUE TRANSACTION CODES
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
  vat_inclusive      BOOLEAN NOT NULL DEFAULT true,
  default_vat_rate   NUMERIC(5,2) NOT NULL DEFAULT 7.00,
  default_serv_rate  NUMERIC(5,2) NOT NULL DEFAULT 10.00,

  -- Posting rules
  allow_manual_post  BOOLEAN NOT NULL DEFAULT true,
  is_rebate          BOOLEAN NOT NULL DEFAULT false,
  is_payment_code    BOOLEAN NOT NULL DEFAULT false,
  is_advance_payment BOOLEAN NOT NULL DEFAULT false,
  default_folio_seq  INT     NOT NULL DEFAULT 1 CHECK (default_folio_seq BETWEEN 1 AND 4),

  -- Display
  sort_order         INT     NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default transaction codes
INSERT INTO public.revenue_transaction_codes
  (code, description, vat_type, vat_inclusive, default_vat_rate, default_serv_rate,
   is_payment_code, is_rebate, allow_manual_post, default_folio_seq, sort_order)
VALUES
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
  ('LATEOUT', 'Late Check-out',           'N', true,  0.00,  0.00, false, false, true,  1, 50),
  ('EARLYIN', 'Early Check-in',           'N', true,  0.00,  0.00, false, false, true,  1, 51),
  ('REBATE',  'Rebate / Adjustment',      'V', true,  7.00,  0.00, false, true,  true,  1, 60),
  ('DISC',    'Discount',                 'N', true,  0.00,  0.00, false, true,  true,  1, 61),
  ('CASH',    'Cash Payment',             'N', true,  0.00,  0.00, true,  false, false, 1, 100),
  ('VISA',    'Visa Card',                'N', true,  0.00,  0.00, true,  false, false, 1, 101),
  ('MCARD',   'Master Card',              'N', true,  0.00,  0.00, true,  false, false, 1, 102),
  ('AMEX',    'American Express',         'N', true,  0.00,  0.00, true,  false, false, 1, 103),
  ('JCB',     'JCB Card',                 'N', true,  0.00,  0.00, true,  false, false, 1, 104),
  ('BKTRF',   'Bank Transfer',            'N', true,  0.00,  0.00, true,  false, true,  1, 105),
  ('CHQUE',   'Cheque',                   'N', true,  0.00,  0.00, true,  false, false, 1, 106),
  ('ONLINE',  'Online Payment',           'N', true,  0.00,  0.00, true,  false, false, 1, 107),
  ('DEPST',   'Advance Deposit',          'N', true,  0.00,  0.00, true,  false, false, 1, 108),
  ('AR',      'City Ledger / AR',         'N', true,  0.00,  0.00, true,  false, true,  1, 109)
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 2. BILLING ADDRESSES
-- =============================================
CREATE TABLE IF NOT EXISTS public.billing_addresses (
  id              UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  UUID  REFERENCES public.reservations(id) ON DELETE CASCADE,
  company_name    TEXT  NOT NULL DEFAULT '',
  attn_name       TEXT  NOT NULL DEFAULT '',
  address_line1   TEXT  NOT NULL DEFAULT '',
  address_line2   TEXT  NOT NULL DEFAULT '',
  address_line3   TEXT  NOT NULL DEFAULT '',
  city            TEXT  NOT NULL DEFAULT '',
  country         TEXT  NOT NULL DEFAULT '',
  tax_id          TEXT  NOT NULL DEFAULT '',
  phone           TEXT  NOT NULL DEFAULT '',
  email           TEXT  NOT NULL DEFAULT '',
  reference_no    TEXT  NOT NULL DEFAULT '',
  created_by      UUID  REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_addresses_reservation
  ON public.billing_addresses(reservation_id);

-- =============================================
-- 3. FOLIO SETUP
-- =============================================
CREATE TABLE IF NOT EXISTS public.folio_setup (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  UUID    NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  tran_code       TEXT    NOT NULL REFERENCES public.revenue_transaction_codes(code) ON DELETE CASCADE,
  folio_seq       INT     NOT NULL DEFAULT 1 CHECK (folio_seq BETWEEN 1 AND 4),
  limit_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  until_date      DATE,
  sort_order      INT     NOT NULL DEFAULT 0,
  created_by      UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folio_setup_reservation
  ON public.folio_setup(reservation_id);
CREATE INDEX IF NOT EXISTS idx_folio_setup_tran_code
  ON public.folio_setup(tran_code);

-- =============================================
-- 4. ALTER FOLIOS - ADD BILLING COLUMNS
-- =============================================
DO $$
BEGIN
  -- Add folio_seq if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folios' AND column_name = 'folio_seq'
  ) THEN
    ALTER TABLE public.folios ADD COLUMN folio_seq INT NOT NULL DEFAULT 1
      CHECK (folio_seq BETWEEN 1 AND 4);
  END IF;

  -- Add lock columns if not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folios' AND column_name = 'is_locked'
  ) THEN
    ALTER TABLE public.folios ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE public.folios ADD COLUMN locked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    ALTER TABLE public.folios ADD COLUMN locked_at TIMESTAMPTZ;
  END IF;

  -- Add billing_address_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folios' AND column_name = 'billing_address_id'
  ) THEN
    ALTER TABLE public.folios ADD COLUMN billing_address_id UUID
      REFERENCES public.billing_addresses(id) ON DELETE SET NULL;
  END IF;

  -- Add unique constraint on (reservation_id, folio_seq)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'folios_reservation_folio_seq_key'
  ) THEN
    ALTER TABLE public.folios ADD CONSTRAINT folios_reservation_folio_seq_key
      UNIQUE (reservation_id, folio_seq);
  END IF;
END $$;

-- =============================================
-- 5. ALTER FOLIO_ITEMS - ADD BILLING COLUMNS
-- =============================================
DO $$
BEGIN
  -- Add transaction code reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'tran_code'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN tran_code TEXT
      REFERENCES public.revenue_transaction_codes(code) ON DELETE SET NULL;
  END IF;

  -- Add VAT breakdown columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'vat_type'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN vat_type TEXT NOT NULL DEFAULT 'V'
      CHECK (vat_type IN ('V','N','E'));
    ALTER TABLE public.folio_items ADD COLUMN vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.folio_items ADD COLUMN vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.folio_items ADD COLUMN service_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.folio_items ADD COLUMN service_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.folio_items ADD COLUMN vatable_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.folio_items ADD COLUMN non_vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Add original amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'org_amount'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN org_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Add PAYF flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'payf'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN payf TEXT NOT NULL DEFAULT ''
      CHECK (payf IN ('', 'I', 'P', 'C', 'W'));
  END IF;

  -- Add shift tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'shift_code'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN shift_code TEXT NOT NULL DEFAULT '';
    ALTER TABLE public.folio_items ADD COLUMN posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- Add credit note columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'credit_note_no'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN credit_note_no INT NOT NULL DEFAULT 0;
    ALTER TABLE public.folio_items ADD COLUMN credit_note_ref INT NOT NULL DEFAULT 0;
  END IF;

  -- Add tax invoice column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'tax_inv_no'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN tax_inv_no INT NOT NULL DEFAULT 0;
  END IF;

  -- Add remark columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'reference'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN reference TEXT NOT NULL DEFAULT '';
    ALTER TABLE public.folio_items ADD COLUMN remark TEXT NOT NULL DEFAULT '';
    ALTER TABLE public.folio_items ADD COLUMN pay_remark1 TEXT NOT NULL DEFAULT '';
    ALTER TABLE public.folio_items ADD COLUMN pay_remark2 TEXT NOT NULL DEFAULT '';
    ALTER TABLE public.folio_items ADD COLUMN pay_remark3 TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add auto_post_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'auto_post_date'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN auto_post_date DATE;
  END IF;

  -- Add advance_payment flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folio_items' AND column_name = 'is_advance_payment'
  ) THEN
    ALTER TABLE public.folio_items ADD COLUMN is_advance_payment BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- =============================================
-- 6. FOLIO PAYMENTS TABLE
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
  card_type        TEXT    NOT NULL DEFAULT '',
  card_number_last4 TEXT   NOT NULL DEFAULT '',
  approval_code    TEXT    NOT NULL DEFAULT '',
  shift_code       TEXT    NOT NULL DEFAULT '',
  is_voided        BOOLEAN NOT NULL DEFAULT false,
  void_reason      TEXT,
  voided_at        TIMESTAMPTZ,
  voided_by        UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by       UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folio_payments_folio_id
  ON public.folio_payments(folio_id);

-- =============================================
-- 7. TAX INVOICES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.tax_invoices (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number  BIGINT  NOT NULL UNIQUE,
  folio_id        UUID    NOT NULL REFERENCES public.folios(id) ON DELETE RESTRICT,
  reservation_id  UUID    REFERENCES public.reservations(id) ON DELETE SET NULL,
  issue_date      DATE    NOT NULL DEFAULT CURRENT_DATE,
  company_name    TEXT    NOT NULL DEFAULT '',
  tax_id          TEXT    NOT NULL DEFAULT '',
  address         TEXT    NOT NULL DEFAULT '',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  service_charge  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_credit_note  BOOLEAN NOT NULL DEFAULT false,
  original_inv_id UUID    REFERENCES public.tax_invoices(id) ON DELETE SET NULL,
  issued_by       UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  printed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
-- SCHEMA V9: NIGHT AUDIT
-- =============================================

CREATE TABLE IF NOT EXISTS public.night_audit_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auto_post_room_charges BOOLEAN NOT NULL DEFAULT true,
  auto_post_time TIME NOT NULL DEFAULT '00:00:00',
  default_room_tran_code TEXT NOT NULL DEFAULT 'ROOM',
  room_posting_days TEXT[] NOT NULL DEFAULT ARRAY['daily'],
  enable_shift_closing BOOLEAN NOT NULL DEFAULT false,
  shift_closing_time TIME NOT NULL DEFAULT '23:59:00',
  notification_emails TEXT[] NOT NULL DEFAULT ARRAY[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.night_audit_config (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.night_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('room_posting', 'shift_closing', 'daily_reconciliation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  items_posted INT DEFAULT 0,
  items_failed INT DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_night_audit_logs_date
  ON public.night_audit_logs(audit_date);

CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_code TEXT NOT NULL,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night')),
  start_time TIME NOT NULL,
  end_time TIME,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_cash NUMERIC(12,2) DEFAULT 0,
  total_cards NUMERIC(12,2) DEFAULT 0,
  total_transfers NUMERIC(12,2) DEFAULT 0,
  total_ar NUMERIC(12,2) DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  total_vat NUMERIC(12,2) DEFAULT 0,
  total_service_charge NUMERIC(12,2) DEFAULT 0,
  room_count INT DEFAULT 0,
  checkout_count INT DEFAULT 0,
  checkin_count INT DEFAULT 0,
  notes TEXT,
  closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shift_code, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_shifts_date
  ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_status
  ON public.shifts(status);

-- =============================================
-- SCHEMA V10: REPORTS
-- =============================================

-- Daily Revenue Report View
CREATE OR REPLACE VIEW public.v_daily_revenue_report AS
WITH daily_revenue AS (
  SELECT
    DATE(fi.created_at) AS report_date,
    CASE
      WHEN tc.code = 'ROOM' THEN 'Room Revenue'
      WHEN tc.code IN ('BREAK', 'LUNCH', 'DINNER') THEN 'Food & Beverage'
      WHEN tc.code = 'MINIBAR' THEN 'Mini Bar'
      WHEN tc.code = 'LAUNDRY' THEN 'Laundry'
      WHEN tc.code = 'PHONE' THEN 'Telephone'
      WHEN tc.code = 'INET' THEN 'Internet'
      WHEN tc.code = 'SPA' THEN 'Spa & Wellness'
      WHEN tc.code = 'PARK' THEN 'Parking'
      WHEN tc.code = 'MISC' THEN 'Miscellaneous'
      WHEN tc.code = 'DAMAGE' THEN 'Damage Charges'
      WHEN tc.code = 'EXBED' THEN 'Extra Bed'
      ELSE 'Other Charges'
    END AS category,
    tc.code AS tran_code,
    tc.description AS tran_description,
    COUNT(fi.id) AS transaction_count,
    SUM(fi.amount) AS total_amount,
    SUM(fi.vat_amount) AS total_vat,
    SUM(fi.service_amount) AS total_service_charge,
    SUM(fi.vatable_amount) AS total_vatable,
    SUM(fi.non_vat_amount) AS total_non_vat
  FROM folio_items fi
  JOIN revenue_transaction_codes tc ON tc.code = fi.tran_code
  WHERE fi.is_voided = false
    AND fi.payf NOT IN ('W')
  GROUP BY
    DATE(fi.created_at),
    CASE
      WHEN tc.code = 'ROOM' THEN 'Room Revenue'
      WHEN tc.code IN ('BREAK', 'LUNCH', 'DINNER') THEN 'Food & Beverage'
      WHEN tc.code = 'MINIBAR' THEN 'Mini Bar'
      WHEN tc.code = 'LAUNDRY' THEN 'Laundry'
      WHEN tc.code = 'PHONE' THEN 'Telephone'
      WHEN tc.code = 'INET' THEN 'Internet'
      WHEN tc.code = 'SPA' THEN 'Spa & Wellness'
      WHEN tc.code = 'PARK' THEN 'Parking'
      WHEN tc.code = 'MISC' THEN 'Miscellaneous'
      WHEN tc.code = 'DAMAGE' THEN 'Damage Charges'
      WHEN tc.code = 'EXBED' THEN 'Extra Bed'
      ELSE 'Other Charges'
    END,
    tc.code,
    tc.description
)
SELECT
  report_date,
  category,
  tran_code,
  tran_description,
  transaction_count,
  total_amount,
  total_vat,
  total_service_charge,
  total_vatable,
  total_non_vat,
  total_amount - total_service_charge AS net_revenue
FROM daily_revenue
ORDER BY report_date DESC, category, tran_code;

-- Payment Reconciliation Report View
CREATE OR REPLACE VIEW public.v_payment_reconciliation_report AS
SELECT
  DATE(fp.created_at) AS report_date,
  fp.payment_method,
  COUNT(fp.id) AS payment_count,
  SUM(fp.amount) AS total_amount,
  COUNT(CASE WHEN fp.is_voided = false THEN 1 END) AS active_payments,
  COUNT(CASE WHEN fp.is_voided = true THEN 1 END) AS voided_payments,
  SUM(CASE WHEN fp.is_voided = false THEN fp.amount ELSE 0 END) AS net_amount,
  SUM(CASE WHEN fp.is_voided = true THEN fp.amount ELSE 0 END) AS voided_amount
FROM folio_payments fp
GROUP BY DATE(fp.created_at), fp.payment_method
ORDER BY report_date DESC, payment_method;

-- Folio Aging Report View
CREATE OR REPLACE VIEW public.v_folio_aging_report AS
SELECT
  f.id AS folio_id,
  f.folio_seq,
  f.folio_number,
  r.reservation_number,
  r.room_id,
  rm.room_number,
  g.first_name || ' ' || g.last_name AS guest_name,
  g.email AS guest_email,
  g.phone AS guest_phone,
  r.check_in_date,
  r.check_out_date,
  r.rate,
  f.total_amount,
  f.paid_amount,
  f.balance,
  f.status AS folio_status,
  CASE
    WHEN f.status = 'closed' THEN 0
    WHEN r.check_out_date < CURRENT_DATE THEN 91
    WHEN r.check_out_date = CURRENT_DATE THEN 90
    WHEN r.check_out_date = CURRENT_DATE + INTERVAL '1 day' THEN 60
    WHEN r.check_out_date BETWEEN CURRENT_DATE + INTERVAL '2 days' AND CURRENT_DATE + INTERVAL '7 days' THEN 30
    WHEN r.check_out_date > CURRENT_DATE + INTERVAL '7 days' THEN 1
    ELSE 0
  END AS aging_days,
  CASE
    WHEN f.status = 'closed' THEN 'Closed'
    WHEN r.check_out_date < CURRENT_DATE THEN 'Overdue'
    WHEN r.check_out_date = CURRENT_DATE THEN 'Due Today'
    WHEN r.check_out_date = CURRENT_DATE + INTERVAL '1 day' THEN 'Due Tomorrow'
    WHEN r.check_out_date BETWEEN CURRENT_DATE + INTERVAL '2 days' AND CURRENT_DATE + INTERVAL '7 days' THEN 'Due 2-7 Days'
    WHEN r.check_out_date > CURRENT_DATE + INTERVAL '7 days' THEN 'Future'
    ELSE 'Unknown'
  END AS aging_category,
  COUNT(fi.id) AS item_count,
  MAX(fi.created_at) AS last_activity,
  COUNT(fp.id) AS payment_count
FROM folios f
JOIN reservations r ON r.id = f.reservation_id
JOIN guests g ON g.id = r.guest_id
LEFT JOIN rooms rm ON rm.id = r.room_id
LEFT JOIN folio_items fi ON fi.folio_id = f.id AND fi.is_voided = false
LEFT JOIN folio_payments fp ON fp.folio_id = f.id AND fp.is_voided = false
WHERE f.deleted_at IS NULL
GROUP BY
  f.id, f.folio_seq, f.folio_number,
  r.reservation_number, r.room_id, r.check_in_date, r.check_out_date, r.rate,
  f.total_amount, f.paid_amount, f.balance, f.status,
  rm.room_number, g.first_name, g.last_name, g.email, g.phone
HAVING f.balance != 0 OR f.status = 'open'
ORDER BY r.check_out_date, f.folio_seq;

-- Tax Invoice Summary View
CREATE OR REPLACE VIEW public.v_tax_invoice_summary AS
SELECT
  ti.issue_date AS report_date,
  ti.invoice_number,
  ti.is_credit_note,
  ti.original_inv_id,
  f.folio_seq,
  f.folio_number,
  r.reservation_number,
  ba.company_name,
  ba.tax_id,
  ba.address,
  ti.subtotal,
  ti.vat_amount,
  ti.service_charge,
  ti.total_amount,
  p.full_name AS issued_by_name,
  ti.printed_at,
  ti.created_at,
  COUNT(fi.id) AS item_count
FROM tax_invoices ti
JOIN folios f ON f.id = ti.folio_id
JOIN reservations r ON r.id = ti.reservation_id
LEFT JOIN billing_addresses ba ON ba.reservation_id = r.id
LEFT JOIN profiles p ON p.id = ti.issued_by
LEFT JOIN folio_items fi ON fi.tax_inv_no = ti.invoice_number AND fi.folio_id = f.id
ORDER BY ti.issue_date DESC, ti.invoice_number DESC;

-- Shift Summary Report View
CREATE OR REPLACE VIEW public.v_shift_summary_report AS
SELECT
  s.shift_date AS report_date,
  s.shift_code,
  s.shift_type,
  s.status,
  s.start_time,
  s.end_time,
  p.full_name AS cashier_name,
  s.total_cash,
  s.total_cards,
  s.total_transfers,
  s.total_ar,
  s.total_revenue,
  s.total_vat,
  s.total_service_charge,
  s.room_count,
  s.checkout_count,
  s.checkin_count,
  s.notes,
  s.closed_at,
  s.closed_by
FROM shifts s
LEFT JOIN profiles p ON p.id = s.cashier_id
ORDER BY s.shift_date DESC, s.shift_type, s.shift_code;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.revenue_transaction_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view tran_codes"
  ON public.revenue_transaction_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage tran_codes"
  ON public.revenue_transaction_codes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

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

ALTER TABLE public.night_audit_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admin manage audit config"
  ON public.night_audit_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

ALTER TABLE public.night_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view audit logs"
  ON public.night_audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ insert audit logs"
  ON public.night_audit_logs FOR INSERT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view shifts"
  ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert shifts"
  ON public.shifts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update shifts"
  ON public.shifts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

-- =============================================
-- INDEXES FOR PERFORMANCE
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
CREATE INDEX IF NOT EXISTS idx_night_audit_config_id
  ON public.night_audit_config(id);
CREATE INDEX IF NOT EXISTS idx_shifts_shift_date
  ON public.shifts(shift_date, shift_code);

-- =============================================
-- DONE - DEPLOYMENT COMPLETE
-- =============================================
