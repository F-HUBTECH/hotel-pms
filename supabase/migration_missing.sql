-- =============================================
-- Hotel PMS - Missing Objects Migration
-- Run this in Supabase SQL Editor
-- Adds everything from Phase 5, 6, and 7 that is missing
-- =============================================

-- =============================================
-- Phase 5: Daily Revenue Summary View (CORRECTED)
-- folio_transactions uses debit/credit, not amount/tax_amount/service_charge
-- =============================================

CREATE OR REPLACE VIEW public.daily_revenue_summary AS
WITH daily_transactions AS (
    SELECT 
        DATE(posted_at) as revenue_date,
        transaction_type,
        SUM(debit) as net_amount,
        0::NUMERIC as tax_amount,
        0::NUMERIC as service_charge,
        SUM(debit) as gross_amount
    FROM 
        public.folio_transactions
    WHERE 
        transaction_type IN ('room_charge', 'service') 
    GROUP BY 
        DATE(posted_at),
        transaction_type
),
payments_summary AS (
    SELECT 
        DATE(posted_at) as revenue_date,
        'payment_collected'::TEXT as transaction_type,
        0::NUMERIC as net_amount,
        0::NUMERIC as tax_amount,
        0::NUMERIC as service_charge,
        SUM(credit) as gross_amount
    FROM 
        public.folio_transactions
    WHERE 
        transaction_type = 'payment'
    GROUP BY 
        DATE(posted_at)
)
SELECT * FROM daily_transactions
UNION ALL
SELECT * FROM payments_summary
ORDER BY revenue_date DESC, transaction_type ASC;

COMMENT ON VIEW public.daily_revenue_summary IS 'Aggregates folio transactions by date and type to support the Daily Manager Revenue Report.';

-- =============================================
-- Trial Balance (Credits vs Debits) View (CORRECTED)
-- account_postings uses gl_account_code, not account_id
-- chart_of_accounts uses type, not account_type
-- =============================================
CREATE OR REPLACE VIEW public.trial_balance_report AS
SELECT 
    gl.type as account_type,
    gl.account_code,
    gl.account_name,
    COALESCE(SUM(ap.debit), 0) as total_debit,
    COALESCE(SUM(ap.credit), 0) as total_credit,
    COALESCE(SUM(ap.debit - ap.credit), 0) as net_balance
FROM 
    public.chart_of_accounts gl
LEFT JOIN 
    public.account_postings ap ON gl.account_code = ap.gl_account_code
GROUP BY 
    gl.type, gl.account_code, gl.account_name
ORDER BY 
    gl.type DESC, gl.account_code ASC;

-- =============================================
-- Guest Ledger View (CORRECTED)
-- folio_transactions uses debit/credit, not amount/tax_amount/service_charge
-- guests table is separate from profiles
-- =============================================
CREATE OR REPLACE VIEW public.guest_ledger_report AS
SELECT 
    f.id as folio_id,
    f.folio_number,
    r.reservation_number,
    (g.first_name || ' ' || g.last_name) as guest_name,
    rm.room_number,
    r.check_in_date,
    r.check_out_date,
    COALESCE(SUM(CASE WHEN ft.transaction_type = 'room_charge' THEN ft.debit ELSE 0 END), 0) as room_charges,
    COALESCE(SUM(CASE WHEN ft.transaction_type = 'tax' THEN ft.debit ELSE 0 END), 0) as taxes,
    COALESCE(SUM(CASE WHEN ft.transaction_type = 'service' THEN ft.debit ELSE 0 END), 0) as service_charges,
    COALESCE(SUM(ft.debit), 0) as total_charges,
    COALESCE((SELECT SUM(credit) FROM public.folio_transactions WHERE transaction_type = 'payment' AND folio_id = f.id), 0) as payments,
    f.balance as current_balance
FROM 
    public.folios f
JOIN 
    public.reservations r ON f.reservation_id = r.id
JOIN 
    public.guests g ON r.guest_id = g.id
LEFT JOIN 
    public.rooms rm ON r.room_id = rm.id
LEFT JOIN 
    public.folio_transactions ft ON f.id = ft.folio_id AND ft.transaction_type IN ('room_charge', 'service', 'tax')
WHERE 
    f.status = 'open' AND r.status IN ('checked_in', 'checked_out')
GROUP BY 
    f.id, f.folio_number, r.reservation_number, g.first_name, g.last_name, rm.room_number, r.check_in_date, r.check_out_date, f.balance
ORDER BY 
    rm.room_number ASC;

-- =============================================
-- Aging Report View (CORRECTED)
-- guests table is separate from profiles
-- =============================================
CREATE OR REPLACE VIEW public.aging_report AS
SELECT 
    f.id as folio_id,
    f.folio_number,
    (g.first_name || ' ' || g.last_name) as account_name,
    f.closed_at,
    f.balance as outstanding_amount,
    CURRENT_DATE - DATE(f.closed_at) as days_overdue,
    CASE 
        WHEN CURRENT_DATE - DATE(f.closed_at) <= 30 THEN f.balance ELSE 0 END as current_30,
    CASE 
        WHEN CURRENT_DATE - DATE(f.closed_at) > 30 AND CURRENT_DATE - DATE(f.closed_at) <= 60 THEN f.balance ELSE 0 END as days_31_60,
    CASE 
        WHEN CURRENT_DATE - DATE(f.closed_at) > 60 AND CURRENT_DATE - DATE(f.closed_at) <= 90 THEN f.balance ELSE 0 END as days_61_90,
    CASE 
        WHEN CURRENT_DATE - DATE(f.closed_at) > 90 THEN f.balance ELSE 0 END as days_over_90
FROM 
    public.folios f
JOIN 
    public.reservations r ON f.reservation_id = r.id
JOIN 
    public.guests g ON r.guest_id = g.id
WHERE 
    f.status = 'closed' AND f.balance > 0
ORDER BY 
    days_overdue DESC;

-- =============================================
-- Phase 6: Multi-Property RLS
-- Add property_id to Profiles
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='property_id') THEN
        ALTER TABLE public.profiles ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;
        
        -- Assign all existing profiles to the default MAIN property
        UPDATE public.profiles SET property_id = (SELECT id FROM public.properties WHERE code = 'MAIN' LIMIT 1) WHERE property_id IS NULL;
    END IF;
END $$;

-- Helper function to fetch the current user's property_id context
CREATE OR REPLACE FUNCTION public.get_user_property_id()
RETURNS UUID AS $$
  SELECT property_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- Phase 7: Group Reservations & Master Folios
-- =============================================

-- 1. GROUP MASTERS table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    contact_name VARCHAR(100),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(100),
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'tentative' CHECK (status IN ('tentative', 'definite', 'cancelled', 'in_house', 'checked_out')),
    cut_off_date DATE,
    market_id UUID REFERENCES public.markets(id) ON DELETE SET NULL,
    source_id UUID REFERENCES public.booking_sources(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    UNIQUE(property_id, code)
);

-- 2. GROUP BLOCKS (Allotments) table
CREATE TABLE IF NOT EXISTS public.group_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
    block_date DATE NOT NULL,
    agreed_rooms INTEGER NOT NULL DEFAULT 0,
    picked_up_rooms INTEGER NOT NULL DEFAULT 0,
    rate NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    UNIQUE(group_id, room_type_id, block_date)
);

-- 3. Update Existing Tables for Group Relations
DO $$
BEGIN
    -- Link Reservations to Groups
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='group_id') THEN
        ALTER TABLE public.reservations ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;
    END IF;

    -- Update Folios to support Master Folios (Group attached, no Reservation)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='folios' AND column_name='group_id') THEN
        ALTER TABLE public.folios ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
        -- Relax the reservation_id constraint so Group folios can exist
        ALTER TABLE public.folios ALTER COLUMN reservation_id DROP NOT NULL;
    END IF;

    -- Update Folio Transactions for Routing Rules
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='folio_transactions' AND column_name='routed_to_folio_id') THEN
        ALTER TABLE public.folio_transactions ADD COLUMN routed_to_folio_id UUID REFERENCES public.folios(id) ON DELETE SET NULL;
        ALTER TABLE public.folio_transactions ADD COLUMN routing_reason VARCHAR(255);
    END IF;
END $$;

-- 4. Enable RLS and Policies for Groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_blocks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view groups in their property" ON public.groups;
DROP POLICY IF EXISTS "Users can operate groups in their property" ON public.groups;
DROP POLICY IF EXISTS "Users can view group blocks" ON public.group_blocks;
DROP POLICY IF EXISTS "Users can operate group blocks" ON public.group_blocks;

CREATE POLICY "Users can view groups in their property" ON public.groups FOR SELECT TO authenticated USING (property_id = public.get_user_property_id() OR public.is_admin_or_above());
CREATE POLICY "Users can operate groups in their property" ON public.groups FOR ALL TO authenticated USING (property_id = public.get_user_property_id() OR public.is_admin_or_above());

CREATE POLICY "Users can view group blocks" ON public.group_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can operate group blocks" ON public.group_blocks FOR ALL TO authenticated USING (public.is_admin_or_above() OR EXISTS(SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()));

-- 5. set_updated_at function (alias for update_updated_at, used in Phase 7 triggers)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Triggers for modified timestamps
DROP TRIGGER IF EXISTS set_updated_at_groups ON public.groups;
CREATE TRIGGER set_updated_at_groups
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_group_blocks ON public.group_blocks;
CREATE TRIGGER set_updated_at_group_blocks
    BEFORE UPDATE ON public.group_blocks
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_groups_property ON public.groups(property_id);
CREATE INDEX IF NOT EXISTS idx_groups_dates ON public.groups(arrival_date, departure_date);
CREATE INDEX IF NOT EXISTS idx_reservations_group ON public.reservations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_blocks_lookup ON public.group_blocks(group_id, room_type_id, block_date);
