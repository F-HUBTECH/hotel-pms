-- Dummy Room Folio: For posting charges without a specific reservation
-- These transactions can later be transferred to a real guest folio

CREATE TABLE IF NOT EXISTS public.dummy_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tran_date DATE NOT NULL,
    tran_code TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    reference TEXT,
    remark TEXT,
    folio_id UUID REFERENCES public.folios(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'cancelled')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dummy_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" 
    ON public.dummy_transactions FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_dummy_transactions_date ON public.dummy_transactions(tran_date);
CREATE INDEX IF NOT EXISTS idx_dummy_transactions_code ON public.dummy_transactions(tran_code);
CREATE INDEX IF NOT EXISTS idx_dummy_transactions_status ON public.dummy_transactions(status);
