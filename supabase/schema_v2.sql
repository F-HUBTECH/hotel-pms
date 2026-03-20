-- =============================================
-- Hotel PMS - Schema V2: Reservations & Folios
-- Run this AFTER schema.sql
-- =============================================

-- Expand room status options
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance', 'out_of_order', 'dirty', 'clean'));

-- =============================================
-- GUESTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  nationality_id UUID REFERENCES public.nationalities(id) ON DELETE SET NULL,
  passport_type_id UUID REFERENCES public.passport_types(id) ON DELETE SET NULL,
  passport_number TEXT DEFAULT '',
  visa_type_id UUID REFERENCES public.visa_types(id) ON DELETE SET NULL,
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- RESERVATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_number TEXT NOT NULL UNIQUE,
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE RESTRICT,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE RESTRICT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  source_id UUID REFERENCES public.booking_sources(id) ON DELETE SET NULL,
  market_id UUID REFERENCES public.markets(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_dates CHECK (check_out_date > check_in_date)
);

-- Reservation number sequence
CREATE SEQUENCE IF NOT EXISTS reservation_number_seq START WITH 1000;

CREATE OR REPLACE FUNCTION public.generate_reservation_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reservation_number IS NULL OR NEW.reservation_number = '' THEN
    NEW.reservation_number := 'RSV-' || LPAD(nextval('reservation_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_reservation_number ON public.reservations;
CREATE TRIGGER set_reservation_number
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.generate_reservation_number();

-- Overlap prevention: no room can have overlapping active reservations
-- Using a function-based check since btree_gist may not be available
CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.room_id IS NOT NULL AND NEW.status IN ('reserved', 'checked_in') THEN
    IF EXISTS (
      SELECT 1 FROM public.reservations
      WHERE room_id = NEW.room_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status IN ('reserved', 'checked_in')
        AND check_in_date < NEW.check_out_date
        AND check_out_date > NEW.check_in_date
    ) THEN
      RAISE EXCEPTION 'Room % is already booked for the selected dates', NEW.room_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_reservation_overlap ON public.reservations;
CREATE TRIGGER prevent_reservation_overlap
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.check_reservation_overlap();

-- =============================================
-- FOLIOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.folios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- FOLIO_ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS public.folio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio_id UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  service_id UUID REFERENCES public.special_services(id) ON DELETE SET NULL,
  item_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- AUDIT_LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_guests_name ON public.guests(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_guests_passport ON public.guests(passport_number);
CREATE INDEX IF NOT EXISTS idx_guests_email ON public.guests(email);

CREATE INDEX IF NOT EXISTS idx_reservations_number ON public.reservations(reservation_number);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON public.reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room ON public.reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON public.reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_checkin ON public.reservations(check_in_date);
CREATE INDEX IF NOT EXISTS idx_reservations_checkout ON public.reservations(check_out_date);

CREATE INDEX IF NOT EXISTS idx_folios_reservation ON public.folios(reservation_id);
CREATE INDEX IF NOT EXISTS idx_folio_items_folio ON public.folio_items(folio_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

-- =============================================
-- UPDATED_AT TRIGGERS for new tables
-- =============================================
CREATE OR REPLACE TRIGGER update_guests_updated_at
  BEFORE UPDATE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER update_folios_updated_at
  BEFORE UPDATE ON public.folios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- RLS POLICIES for new tables
-- =============================================

-- GUESTS: all authenticated can read/write
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view guests" ON public.guests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can create guests" ON public.guests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update guests" ON public.guests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete guests" ON public.guests FOR DELETE TO authenticated USING (public.is_admin_or_above());

-- RESERVATIONS: staff create, manager cancel, admin delete
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view reservations" ON public.reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can create reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update reservations" ON public.reservations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete reservations" ON public.reservations FOR DELETE TO authenticated USING (public.is_admin_or_above());

-- FOLIOS: read all, write with auth
ALTER TABLE public.folios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view folios" ON public.folios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can create folios" ON public.folios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update folios" ON public.folios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete folios" ON public.folios FOR DELETE TO authenticated USING (public.is_admin_or_above());

-- FOLIO_ITEMS
ALTER TABLE public.folio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view folio_items" ON public.folio_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can create folio_items" ON public.folio_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update folio_items" ON public.folio_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete folio_items" ON public.folio_items FOR DELETE TO authenticated USING (public.is_admin_or_above());

-- AUDIT_LOGS: read-only for all, insert for auth
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can create audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
