-- Guest Summary History table
-- Tracks aggregated guest visit statistics (KFO: guestsumhis)

CREATE TABLE IF NOT EXISTS public.guest_summary_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    total_visits INT NOT NULL DEFAULT 0,
    total_room_nights INT NOT NULL DEFAULT 0,
    total_revenue NUMERIC(12,2) DEFAULT 0,
    first_stay_date DATE,
    last_stay_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guest_id)
);

ALTER TABLE public.guest_summary_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.guest_summary_history FOR ALL TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_guest_summary_guest ON public.guest_summary_history(guest_id);

-- Guest Individual Visit History (KFO: customervisithis)
CREATE TABLE IF NOT EXISTS public.guest_visit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_number TEXT,
    room_type_id UUID REFERENCES public.room_types(id) ON DELETE SET NULL,
    room_type_name TEXT,
    rate NUMERIC(10,2) DEFAULT 0,
    total_charges NUMERIC(12,2) DEFAULT 0,
    total_payments NUMERIC(12,2) DEFAULT 0,
    balance NUMERIC(12,2) DEFAULT 0,
    status TEXT CHECK (status IN ('checked_in', 'checked_out', 'cancelled', 'no_show')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.guest_visit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.guest_visit_history FOR ALL TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_visit_history_guest ON public.guest_visit_history(guest_id);
CREATE INDEX IF NOT EXISTS idx_visit_history_reservation ON public.guest_visit_history(reservation_id);
CREATE INDEX IF NOT EXISTS idx_visit_history_date ON public.guest_visit_history(check_in_date);

-- Function to check if guest is a return guest
CREATE OR REPLACE FUNCTION public.is_return_guest(p_guest_id UUID)
RETURNS TABLE (
    is_return BOOLEAN,
    total_visits INT,
    total_room_nights INT,
    first_stay DATE,
    last_stay DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN gsh.total_visits > 0 THEN TRUE ELSE FALSE END,
        COALESCE(gsh.total_visits, 0),
        COALESCE(gsh.total_room_nights, 0),
        gsh.first_stay_date,
        gsh.last_stay_date
    FROM public.guest_summary_history gsh
    WHERE gsh.guest_id = p_guest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get guest visit history
CREATE OR REPLACE FUNCTION public.get_guest_visit_history(p_guest_id UUID)
RETURNS TABLE (
    id UUID,
    check_in_date DATE,
    check_out_date DATE,
    room_number TEXT,
    room_type_name TEXT,
    status TEXT,
    total_charges NUMERIC(12,2),
    rate NUMERIC(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gvh.id,
        gvh.check_in_date,
        gvh.check_out_date,
        gvh.room_number,
        gvh.room_type_name,
        gvh.status,
        gvh.total_charges,
        gvh.rate
    FROM public.guest_visit_history gvh
    WHERE gvh.guest_id = p_guest_id
    ORDER BY gvh.check_in_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
