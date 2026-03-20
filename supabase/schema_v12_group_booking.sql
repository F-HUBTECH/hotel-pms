-- =============================================
-- Phase 12: Group Booking (Full Migration from KFO Dephoi)
-- Replicating: bookheader, customer, depositrev, company features
-- =============================================

-- 1. GROUP BOOKINGS - From KFO bookheader table
-- Represents bookings under a group (room types, rates, pax)
CREATE TABLE IF NOT EXISTS public.group_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    room_type_id UUID REFERENCES public.room_types(id) ON DELETE SET NULL,
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    room_qty INTEGER NOT NULL DEFAULT 1,
    room_qty_single INTEGER NOT NULL DEFAULT 0,
    room_qty_twin INTEGER NOT NULL DEFAULT 0,
    room_qty_triple INTEGER NOT NULL DEFAULT 0,
    room_qty_quad INTEGER NOT NULL DEFAULT 0,
    pax_adult INTEGER NOT NULL DEFAULT 0,
    pax_child INTEGER NOT NULL DEFAULT 0,
    rate_code VARCHAR(20),
    rate_amount NUMERIC(12,2) DEFAULT 0,
    rate_single NUMERIC(12,2) DEFAULT 0,
    rate_twin NUMERIC(12,2) DEFAULT 0,
    rate_triple NUMERIC(12,2) DEFAULT 0,
    rate_quad NUMERIC(12,2) DEFAULT 0,
    rate_monthly NUMERIC(12,2) DEFAULT 0,
    rate_weekly NUMERIC(12,2) DEFAULT 0,
    commission_percent NUMERIC(8,2) DEFAULT 0,
    commission_amount NUMERIC(12,2) DEFAULT 0,
    booktype VARCHAR(10),
    market_id UUID REFERENCES public.markets(id) ON DELETE SET NULL,
    source_id UUID REFERENCES public.booking_sources(id) ON DELETE SET NULL,
    allot_code VARCHAR(20),
    allot_rmtype VARCHAR(10),
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'confirmed', 'cancelled', 'checked_in', 'checked_out', 'no_show')),
    remark TEXT,
    upgrade_room_type VARCHAR(10),
    is_breakfast_included BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    UNIQUE(group_id, room_type_id, arrival_date)
);

-- 2. GROUP GUESTS (Rooming List) - From KFO customer table
-- Individual guests in rooming list
CREATE TABLE IF NOT EXISTS public.group_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    group_booking_id UUID REFERENCES public.group_bookings(id) ON DELETE SET NULL,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    
    -- Guest Name
    title VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    guest_name VARCHAR(255) GENERATED ALWAYS AS (COALESCE(first_name || ' ', '') || COALESCE(last_name, '')) STORED,
    
    -- Room Assignment
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_number VARCHAR(20),
    room_type_id UUID REFERENCES public.room_types(id) ON DELETE SET NULL,
    share_id UUID REFERENCES public.group_guests(id) ON DELETE SET NULL,
    is_share_room BOOLEAN DEFAULT FALSE,
    
    -- Stay Dates
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    room_nights INTEGER NOT NULL DEFAULT 0,
    
    -- Pax
    pax_adult INTEGER NOT NULL DEFAULT 1,
    pax_child INTEGER NOT NULL DEFAULT 0,
    
    -- Rate
    rate_amount NUMERIC(12,2) DEFAULT 0,
    rate_code VARCHAR(20),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'waiting_list')),
    
    -- Guest Details
    guest_type_id UUID REFERENCES public.guest_types(id) ON DELETE SET NULL,
    nationality_id UUID REFERENCES public.nationalities(id) ON DELETE SET NULL,
    passport_type VARCHAR(50),
    passport_number VARCHAR(50),
    birth_date DATE,
    gender VARCHAR(10),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(100),
    
    -- Flight Info
    arrival_flight VARCHAR(50),
    arrival_time VARCHAR(10),
    departure_flight VARCHAR(50),
    departure_time VARCHAR(10),
    
    -- VIP
    is_vip BOOLEAN DEFAULT FALSE,
    vip_level VARCHAR(20),
    vip_note TEXT,

    -- Company/Agent (stored as text for now)
    company_name VARCHAR(255),
    agent_name VARCHAR(255),
    commission_percent NUMERIC(8,2) DEFAULT 0,
    commission_amount NUMERIC(12,2) DEFAULT 0,
    
    -- Check-in/Out
    check_in_date DATE,
    check_in_time VARCHAR(10),
    check_in_by VARCHAR(100),
    check_out_date DATE,
    check_out_time VARCHAR(10),
    check_out_by VARCHAR(100),
    
    -- Payment
    deposit_amount NUMERIC(12,2) DEFAULT 0,
    payment_method VARCHAR(50),
    
    -- Services
    meal_type VARCHAR(20),
    meal_adult_pax INTEGER DEFAULT 0,
    meal_child_pax INTEGER DEFAULT 0,
    transfer_in VARCHAR(50),
    transfer_out VARCHAR(50),
    special_service TEXT,
    
    -- Additional
    remark TEXT,
    internal_note TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. GROUP AGENTS/COMPANIES - From KFO company table
-- Agent/Company commission settings
CREATE TABLE IF NOT EXISTS public.group_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    
    -- Company Info
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    company_type VARCHAR(20) NOT NULL DEFAULT 'agent' 
        CHECK (company_type IN ('agent', 'company', 'corporate', 'tour_operator')),
    
    -- Contact
    contact_name VARCHAR(100),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    address TEXT,
    tax_id VARCHAR(50),
    
    -- Commission
    commission_percent NUMERIC(8,2) DEFAULT 0,
    commission_amt NUMERIC(12,2) DEFAULT 0,
    commission_type VARCHAR(20) DEFAULT 'percentage'
        CHECK (commission_type IN ('percentage', 'fixed', 'per_room', 'per_night')),
    
    -- Payment Terms
    payment_terms VARCHAR(50),
    credit_limit NUMERIC(12,2) DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    UNIQUE(property_id, code)
);

-- 4. GROUP DEPOSITS - From KFO depositrev table
-- Deposit tracking
CREATE TABLE IF NOT EXISTS public.group_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    group_guest_id UUID REFERENCES public.group_guests(id) ON DELETE SET NULL,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    master_folio_id UUID REFERENCES public.folios(id) ON DELETE SET NULL,
    
    -- Transaction
    tran_date DATE NOT NULL,
    tran_time VARCHAR(10),
    tran_code VARCHAR(10) NOT NULL,
    description VARCHAR(255),
    
    -- Amount
    amount NUMERIC(12,2) NOT NULL,
    original_amount NUMERIC(12,2) NOT NULL,
    
    -- Payment
    payment_method VARCHAR(50),
    reference VARCHAR(50),
    credit_card_no VARCHAR(50),
    credit_card_expire VARCHAR(10),
    approval_code VARCHAR(20),
    
    -- Tax
    vat_percent NUMERIC(8,2) DEFAULT 0,
    vat_amount NUMERIC(12,2) DEFAULT 0,
    vat_type VARCHAR(10) DEFAULT 'inclusive',
    service_charge_percent NUMERIC(8,2) DEFAULT 0,
    service_charge_amount NUMERIC(12,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'applied', 'refunded', 'cancelled', 'transferred')),
    
    -- Transfer Info (for moving deposit to individual folio)
    transfer_to_guest_id UUID REFERENCES public.group_guests(id) ON DELETE SET NULL,
    transfer_to_reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    transfer_date DATE,
    transfer_by VARCHAR(100),
    
    -- Folio
    folio_number VARCHAR(20),
    
    -- User
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    shift_code VARCHAR(10),
    
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 5. GROUP SERVICES - Additional services (ABF, Transfer, etc.)
CREATE TABLE IF NOT EXISTS public.group_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    group_booking_id UUID REFERENCES public.group_bookings(id) ON DELETE SET NULL,
    
    service_type VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    
    -- Pricing
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    
    -- Dates
    service_date DATE NOT NULL,
    
    -- Status
    is_included BOOLEAN DEFAULT FALSE,
    is_posted BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 6. Update groups table with more fields from KFO
DO $$
BEGIN
    -- Add expected rooms
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='expected_rooms') THEN
        ALTER TABLE public.groups ADD COLUMN expected_rooms INTEGER DEFAULT 0;
    END IF;
    
    -- Add picked up rooms (actual reservations)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='picked_up_rooms') THEN
        ALTER TABLE public.groups ADD COLUMN picked_up_rooms INTEGER DEFAULT 0;
    END IF;
    
    -- Add reference fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='reference_no') THEN
        ALTER TABLE public.groups ADD COLUMN reference_no VARCHAR(50);
    END IF;
    
    -- Add booking by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='booked_by') THEN
        ALTER TABLE public.groups ADD COLUMN booked_by VARCHAR(100);
    END IF;
    
    -- Add confirmation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='confirm_date') THEN
        ALTER TABLE public.groups ADD COLUMN confirm_date DATE;
    END IF;
    
    -- Add deposit expected
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='deposit_expected') THEN
        ALTER TABLE public.groups ADD COLUMN deposit_expected NUMERIC(12,2) DEFAULT 0;
    END IF;
    
    -- Add internal note
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='internal_note') THEN
        ALTER TABLE public.groups ADD COLUMN internal_note TEXT;
    END IF;
END $$;

-- 7. Enable RLS and Policies
ALTER TABLE public.group_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_services ENABLE ROW LEVEL SECURITY;

-- Group Bookings Policies
CREATE POLICY "Users can view group bookings" ON public.group_bookings FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()) 
    OR public.is_admin_or_above()
);
CREATE POLICY "Users can operate group bookings" ON public.group_bookings FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()) 
    OR public.is_admin_or_above()
);

-- Group Guests Policies
CREATE POLICY "Users can view group guests" ON public.group_guests FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()) 
    OR public.is_admin_or_above()
);
CREATE POLICY "Users can operate group guests" ON public.group_guests FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()) 
    OR public.is_admin_or_above()
);

-- Group Agents Policies
CREATE POLICY "Users can view group agents" ON public.group_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can operate group agents" ON public.group_agents FOR ALL TO authenticated USING (
    property_id = public.get_user_property_id() OR public.is_admin_or_above()
);

-- Group Deposits Policies
CREATE POLICY "Users can view group deposits" ON public.group_deposits FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()) 
    OR public.is_admin_or_above()
);
CREATE POLICY "Users can operate group deposits" ON public.group_deposits FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()) 
    OR public.is_admin_or_above()
);

-- Group Services Policies
CREATE POLICY "Users can view group services" ON public.group_services FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()) 
    OR public.is_admin_or_above()
);
CREATE POLICY "Users can operate group services" ON public.group_services FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()) 
    OR public.is_admin_or_above()
);

-- 8. Triggers for updated_at
CREATE TRIGGER set_updated_at_group_bookings
    BEFORE UPDATE ON public.group_bookings
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_group_guests
    BEFORE UPDATE ON public.group_guests
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_group_agents
    BEFORE UPDATE ON public.group_agents
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_group_deposits
    BEFORE UPDATE ON public.group_deposits
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_group_services
    BEFORE UPDATE ON public.group_services
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_group_bookings_group ON public.group_bookings(group_id);
CREATE INDEX IF NOT EXISTS idx_group_bookings_dates ON public.group_bookings(arrival_date, departure_date);
CREATE INDEX IF NOT EXISTS idx_group_bookings_status ON public.group_bookings(status);

CREATE INDEX IF NOT EXISTS idx_group_guests_group ON public.group_guests(group_id);
CREATE INDEX IF NOT EXISTS idx_group_guests_booking ON public.group_guests(group_booking_id);
CREATE INDEX IF NOT EXISTS idx_group_guests_reservation ON public.group_guests(reservation_id);
CREATE INDEX IF NOT EXISTS idx_group_guests_room ON public.group_guests(room_id);
CREATE INDEX IF NOT EXISTS idx_group_guests_status ON public.group_guests(status);
CREATE INDEX IF NOT EXISTS idx_group_guests_name ON public.group_guests(last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_group_agents_property ON public.group_agents(property_id);
CREATE INDEX IF NOT EXISTS idx_group_agents_code ON public.group_agents(code);

CREATE INDEX IF NOT EXISTS idx_group_deposits_group ON public.group_deposits(group_id);
CREATE INDEX IF NOT EXISTS idx_group_deposits_guest ON public.group_deposits(group_guest_id);
CREATE INDEX IF NOT EXISTS idx_group_deposits_status ON public.group_deposits(status);

CREATE INDEX IF NOT EXISTS idx_group_services_group ON public.group_services(group_id);
CREATE INDEX IF NOT EXISTS idx_group_services_date ON public.group_services(service_date);

-- 10. Update groups trigger to calculate picked_up_rooms
CREATE OR REPLACE FUNCTION public.calculate_group_picked_rooms()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE public.groups g
        SET picked_up_rooms = (
            SELECT COALESCE(SUM(room_qty), 0)
            FROM public.group_bookings
            WHERE group_id = NEW.group_id AND status IN ('active', 'confirmed', 'checked_in')
        )
        WHERE g.id = NEW.group_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.groups g
        SET picked_up_rooms = (
            SELECT COALESCE(SUM(room_qty), 0)
            FROM public.group_bookings
            WHERE group_id = OLD.group_id AND status IN ('active', 'confirmed', 'checked_in')
        )
        WHERE g.id = OLD.group_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_picked_rooms ON public.group_bookings;
CREATE TRIGGER trigger_calculate_picked_rooms
    AFTER INSERT OR UPDATE OR DELETE ON public.group_bookings
    FOR EACH ROW EXECUTE PROCEDURE public.calculate_group_picked_rooms();
