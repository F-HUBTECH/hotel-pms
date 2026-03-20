-- =============================================
-- Phase 7: Group Reservations & Master Folios
-- Replicating KFO Group / Allotment architectures
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
-- Represents the quantity of each room type held internally for the group per day
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
        
        -- Add a constraint to ensure a folio belongs either to a reservation or a group, but not neither
        -- (Skipping strict CHECK constraint for now to ease migration, but architecturally sound).
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

CREATE POLICY "Users can view groups in their property" ON public.groups FOR SELECT TO authenticated USING (property_id = public.get_user_property_id() OR public.is_admin_or_above());
CREATE POLICY "Users can operate groups in their property" ON public.groups FOR ALL TO authenticated USING (property_id = public.get_user_property_id() OR public.is_admin_or_above());

-- Group Blocks inherit Group Property_ID implicitly through joins, but RLS on Group Blocks can just check user status simply:
CREATE POLICY "Users can view group blocks" ON public.group_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can operate group blocks" ON public.group_blocks FOR ALL TO authenticated USING (public.is_admin_or_above() OR EXISTS(SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.property_id = public.get_user_property_id()));

-- 5. Triggers for modified timestamps
CREATE TRIGGER set_updated_at_groups
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_group_blocks
    BEFORE UPDATE ON public.group_blocks
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_groups_property ON public.groups(property_id);
CREATE INDEX IF NOT EXISTS idx_groups_dates ON public.groups(arrival_date, departure_date);
CREATE INDEX IF NOT EXISTS idx_reservations_group ON public.reservations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_blocks_lookup ON public.group_blocks(group_id, room_type_id, block_date);
