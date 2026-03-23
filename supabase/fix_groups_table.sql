-- Create groups table
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

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.groups;
CREATE POLICY "Allow all for authenticated users" ON public.groups FOR ALL TO authenticated USING (true);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload';
