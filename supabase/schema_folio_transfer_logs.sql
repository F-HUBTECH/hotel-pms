-- Folio Transfer Logs
-- เก็บประวัติการย้าย transaction ระหว่าง folio

CREATE TABLE IF NOT EXISTS public.folio_transfer_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.folio_items(id) ON DELETE CASCADE,
    source_folio_id UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
    target_folio_id UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
    tran_code TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    tran_date DATE NOT NULL,
    transferred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remark TEXT,
    transfer_type TEXT DEFAULT 'folio' CHECK (transfer_type IN ('folio', 'dummy_to_folio'))
);

ALTER TABLE public.folio_transfer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" 
    ON public.folio_transfer_logs FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_transfer_logs_item ON public.folio_transfer_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_source ON public.folio_transfer_logs(source_folio_id);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_target ON public.folio_transfer_logs(target_folio_id);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_date ON public.folio_transfer_logs(tran_date);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_transferred_at ON public.folio_transfer_logs(transferred_at);

-- View for transfer history report
CREATE OR REPLACE VIEW public.v_folio_transfer_logs AS
SELECT 
    ftl.id,
    ftl.item_id,
    ftl.tran_code,
    ftl.description,
    ftl.amount,
    ftl.tran_date,
    ftl.transferred_at,
    ftl.remark,
    ftl.transfer_type,
    ftl.transferred_by,
    p.full_name AS transferred_by_name,
    sf.folio_number AS source_folio_number,
    sf.folio_seq AS source_folio_seq,
    tf.folio_number AS target_folio_number,
    tf.folio_seq AS target_folio_seq,
    r.reservation_number AS source_reservation_number,
    r2.reservation_number AS target_reservation_number,
    g.first_name || ' ' || g.last_name AS source_guest_name,
    g2.first_name || ' ' || g2.last_name AS target_guest_name,
    rm.room_number AS source_room_number,
    rm2.room_number AS target_room_number
FROM public.folio_transfer_logs ftl
JOIN public.folios sf ON sf.id = ftl.source_folio_id
JOIN public.folios tf ON tf.id = ftl.target_folio_id
LEFT JOIN public.reservations r ON r.id = sf.reservation_id
LEFT JOIN public.reservations r2 ON r2.id = tf.reservation_id
LEFT JOIN public.guests g ON g.id = r.guest_id
LEFT JOIN public.guests g2 ON g2.id = r2.guest_id
LEFT JOIN public.rooms rm ON rm.id = r.room_id
LEFT JOIN public.rooms rm2 ON rm2.id = r2.room_id
LEFT JOIN public.profiles p ON p.id = ftl.transferred_by
ORDER BY ftl.transferred_at DESC;
