-- =============================================
-- Allotment System Tables
-- Replicates KFO Dephoi allotment functionality
-- =============================================

-- 1. ALLOTMENT CONTRACTS (already exists as corporate_allotments, but let's add missing columns)
ALTER TABLE public.corporate_allotments 
ADD COLUMN IF NOT EXISTS contract_no TEXT,
ADD COLUMN IF NOT EXISTS contract_date DATE,
ADD COLUMN IF NOT EXISTS cut_off_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS deposit_required NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_bed_rate NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS child_rate NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS breakfast_included BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS breakfast_rate NUMERIC(12,2) DEFAULT 0;

-- 2. ALLOTMENT ROOM TYPES - Room type specific allotments per contract
CREATE TABLE IF NOT EXISTS public.allotment_room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allotment_id UUID NOT NULL REFERENCES public.corporate_allotments(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
    agreed_rooms INTEGER NOT NULL DEFAULT 0,
    rate_code VARCHAR(20),
    base_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
    extra_bed_rate NUMERIC(12,2) DEFAULT 0,
    breakfast_rate NUMERIC(12,2) DEFAULT 0,
    is_guaranteed BOOLEAN DEFAULT FALSE,
    cutoff_days INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(allotment_id, room_type_id)
);

-- 3. ALLOTMENT DAILY - Daily tracking of allotments
CREATE TABLE IF NOT EXISTS public.allotment_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allotment_id UUID NOT NULL REFERENCES public.corporate_allotments(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
    allott_date DATE NOT NULL,
    total_rooms INTEGER NOT NULL DEFAULT 0,
    used_rooms INTEGER NOT NULL DEFAULT 0,
    available_rooms INTEGER GENERATED ALWAYS AS (total_rooms - used_rooms) STORED,
    picked_rooms INTEGER NOT NULL DEFAULT 0,
    released_rooms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(allotment_id, room_type_id, allott_date)
);

-- 4. ALLOTMENT PICKUPS - Rooms picked from allotment for reservations
CREATE TABLE IF NOT EXISTS public.allotment_pickups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allotment_id UUID NOT NULL REFERENCES public.corporate_allotments(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
    pickup_date DATE NOT NULL,
    rooms_picked INTEGER NOT NULL DEFAULT 1,
    rate NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'picked' CHECK (status IN ('picked', 'confirmed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_allotment_room_types_allotment ON public.allotment_room_types(allotment_id);
CREATE INDEX IF NOT EXISTS idx_allotment_room_types_room_type ON public.allotment_room_types(room_type_id);
CREATE INDEX IF NOT EXISTS idx_allotment_daily_allotment ON public.allotment_daily(allotment_id);
CREATE INDEX IF NOT EXISTS idx_allotment_daily_date ON public.allotment_daily(allott_date);
CREATE INDEX IF NOT EXISTS idx_allotment_pickups_allotment ON public.allotment_pickups(allotment_id);
CREATE INDEX IF NOT EXISTS idx_allotment_pickups_reservation ON public.allotment_pickups(reservation_id);

-- Enable RLS
ALTER TABLE public.allotment_room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allotment_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allotment_pickups ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all for authenticated users" ON public.allotment_room_types FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.allotment_daily FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users" ON public.allotment_pickups FOR ALL TO authenticated USING (true);

-- Function to initialize daily allotments from contract
CREATE OR REPLACE FUNCTION public.initialize_allotment_daily(
    p_allotment_id UUID,
    p_room_type_id UUID,
    p_from_date DATE,
    p_to_date DATE,
    p_agreed_rooms INTEGER
) RETURNS void AS $$
DECLARE
    v_date DATE;
BEGIN
    v_date := p_from_date;
    WHILE v_date <= p_to_date LOOP
        INSERT INTO public.allotment_daily (allotment_id, room_type_id, allott_date, total_rooms, used_rooms, picked_rooms)
        VALUES (p_allotment_id, p_room_type_id, v_date, p_agreed_rooms, 0, 0)
        ON CONFLICT (allotment_id, room_type_id, allott_date) 
        DO UPDATE SET total_rooms = p_agreed_rooms;
        v_date := v_date + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify PostgREST
NOTIFY pgrst, 'reload';
