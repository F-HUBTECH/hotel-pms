-- =============================================
-- Hotel PMS - Schema V3: Full Operations
-- Run this AFTER schema_v2.sql
-- =============================================

-- =============================================
-- PROPERTIES (multi-property support)
-- =============================================
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default property
INSERT INTO public.properties (name, code, address, timezone)
VALUES ('Main Hotel', 'MAIN', 'Default Address', 'Asia/Bangkok')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- Add property_id to existing tables
-- =============================================
DO $$
DECLARE
  default_prop_id UUID;
BEGIN
  SELECT id INTO default_prop_id FROM public.properties WHERE code = 'MAIN' LIMIT 1;

  -- Add property_id columns if not exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='buildings' AND column_name='property_id') THEN
    ALTER TABLE public.buildings ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;
    UPDATE public.buildings SET property_id = default_prop_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='property_id') THEN
    ALTER TABLE public.rooms ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;
    UPDATE public.rooms SET property_id = default_prop_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservations' AND column_name='property_id') THEN
    ALTER TABLE public.reservations ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;
    UPDATE public.reservations SET property_id = default_prop_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_types' AND column_name='property_id') THEN
    ALTER TABLE public.room_types ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;
    UPDATE public.room_types SET property_id = default_prop_id;
  END IF;
END $$;

-- =============================================
-- Add soft delete (deleted_at) to major tables
-- =============================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'buildings', 'rooms', 'room_types', 'reservations', 'guests',
    'folios', 'rate_groups', 'rate_formulas', 'market_groups', 'markets',
    'guest_types', 'nationalities', 'passport_types', 'visa_types',
    'booking_sources', 'channels', 'departments', 'user_groups',
    'special_services', 'folio_groups', 'zone_codes'
  ])
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=tbl AND column_name='deleted_at') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN deleted_at TIMESTAMPTZ', tbl);
    END IF;
  END LOOP;
END $$;

-- =============================================
-- ROOM_INVENTORY (daily tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS public.room_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
  inventory_date DATE NOT NULL,
  total_rooms INT NOT NULL DEFAULT 0,
  available_rooms INT NOT NULL DEFAULT 0,
  reserved_rooms INT NOT NULL DEFAULT 0,
  out_of_order_rooms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, room_type_id, inventory_date)
);

-- =============================================
-- RATE_PLANS
-- =============================================
CREATE TABLE IF NOT EXISTS public.rate_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  refundable BOOLEAN NOT NULL DEFAULT true,
  cancellation_policy TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- SEASONAL_RATES
-- =============================================
CREATE TABLE IF NOT EXISTS public.seasonal_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_plan_id UUID NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seasonal_dates_check CHECK (end_date >= start_date)
);

-- =============================================
-- WEEKDAY_RATES
-- =============================================
CREATE TABLE IF NOT EXISTS public.weekday_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_plan_id UUID NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rate_plan_id, weekday)
);

-- =============================================
-- PAYMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'credit_card', 'transfer', 'other')),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  reference_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- HOUSEKEEPING_TASKS
-- =============================================
CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  task_type TEXT NOT NULL DEFAULT 'cleaning'
    CHECK (task_type IN ('cleaning', 'inspection', 'maintenance', 'turndown')),
  notes TEXT DEFAULT '',
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expand room status to include 'inspected'
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance', 'out_of_order', 'dirty', 'clean', 'inspected'));

-- =============================================
-- NIGHT_AUDITS
-- =============================================
CREATE TABLE IF NOT EXISTS public.night_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  audit_date DATE NOT NULL,
  total_rooms INT NOT NULL DEFAULT 0,
  occupied_rooms INT NOT NULL DEFAULT 0,
  occupancy_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  adr NUMERIC(10,2) NOT NULL DEFAULT 0,
  revpar NUMERIC(10,2) NOT NULL DEFAULT 0,
  no_shows INT NOT NULL DEFAULT 0,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, audit_date)
);

-- =============================================
-- CHANNEL_RESERVATIONS (OTA integration prep)
-- =============================================
CREATE TABLE IF NOT EXISTS public.channel_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE RESTRICT,
  external_id TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'cancelled')),
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_properties_code ON public.properties(code);
CREATE INDEX IF NOT EXISTS idx_buildings_property ON public.buildings(property_id);
CREATE INDEX IF NOT EXISTS idx_rooms_property ON public.rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_room_types_property ON public.room_types(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_property ON public.reservations(property_id);

CREATE INDEX IF NOT EXISTS idx_room_inventory_lookup ON public.room_inventory(property_id, room_type_id, inventory_date);
CREATE INDEX IF NOT EXISTS idx_rate_plans_property ON public.rate_plans(property_id);
CREATE INDEX IF NOT EXISTS idx_rate_plans_room_type ON public.rate_plans(room_type_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_rates_plan ON public.seasonal_rates(rate_plan_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_rates_dates ON public.seasonal_rates(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_weekday_rates_plan ON public.weekday_rates(rate_plan_id);

CREATE INDEX IF NOT EXISTS idx_payments_reservation ON public.payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_room ON public.housekeeping_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_status ON public.housekeeping_tasks(status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_date ON public.housekeeping_tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_night_audits_lookup ON public.night_audits(property_id, audit_date);
CREATE INDEX IF NOT EXISTS idx_channel_resv_external ON public.channel_reservations(channel_id, external_id);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'properties', 'room_inventory', 'rate_plans',
    'housekeeping_tasks', 'channel_reservations'
  ])
  LOOP
    EXECUTE format('
      CREATE OR REPLACE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    ', tbl, tbl);
  END LOOP;
END $$;

-- =============================================
-- AUDIT LOG TRIGGER (auto insert on changes)
-- =============================================
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (action, table_name, record_id, old_data)
    VALUES (TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (action, table_name, record_id, old_data, new_data)
    VALUES (TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (action, table_name, record_id, new_data)
    VALUES (TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to key tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'reservations', 'folios', 'payments', 'housekeeping_tasks'
  ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS audit_%I ON public.%I;
      CREATE TRIGGER audit_%I
        AFTER INSERT OR UPDATE OR DELETE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- =============================================
-- RPC: Transactional Reservation Create
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_create_reservation(
  p_property_id UUID,
  p_guest_id UUID,
  p_room_id UUID,
  p_room_type_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_adults INT DEFAULT 1,
  p_children INT DEFAULT 0,
  p_rate NUMERIC DEFAULT 0,
  p_source_id UUID DEFAULT NULL,
  p_market_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT '',
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_reservation_id UUID;
  v_num TEXT;
BEGIN
  -- Validate dates
  IF p_check_out <= p_check_in THEN
    RAISE EXCEPTION 'Check-out must be after check-in';
  END IF;

  -- Check overlap if room assigned
  IF p_room_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.reservations
      WHERE room_id = p_room_id
        AND status IN ('reserved', 'checked_in')
        AND check_in_date < p_check_out
        AND check_out_date > p_check_in
    ) THEN
      RAISE EXCEPTION 'Room is already booked for the selected dates';
    END IF;
  END IF;

  -- Generate reservation number
  v_num := 'RSV-' || LPAD(nextval('reservation_number_seq')::TEXT, 6, '0');

  -- Insert reservation
  INSERT INTO public.reservations (
    reservation_number, property_id, guest_id, room_id, room_type_id,
    check_in_date, check_out_date, adults, children, rate,
    status, source_id, market_id, notes, created_by
  ) VALUES (
    v_num, p_property_id, p_guest_id, p_room_id, p_room_type_id,
    p_check_in, p_check_out, p_adults, p_children, p_rate,
    'reserved', p_source_id, p_market_id, p_notes, p_created_by
  ) RETURNING id INTO v_reservation_id;

  -- Create folio
  INSERT INTO public.folios (reservation_id, total_amount, status)
  VALUES (v_reservation_id, 0, 'open');

  -- Update room status
  IF p_room_id IS NOT NULL THEN
    UPDATE public.rooms SET status = 'reserved' WHERE id = p_room_id;
  END IF;

  -- Update room inventory
  UPDATE public.room_inventory
  SET reserved_rooms = reserved_rooms + 1,
      available_rooms = GREATEST(available_rooms - 1, 0)
  WHERE property_id = p_property_id
    AND room_type_id = p_room_type_id
    AND inventory_date >= p_check_in
    AND inventory_date < p_check_out;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RPC: Rate Calculation
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_calculate_rate(
  p_rate_plan_id UUID,
  p_check_in DATE,
  p_check_out DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC := 0;
  v_date DATE;
  v_price NUMERIC;
  v_base NUMERIC;
  v_weekday INT;
BEGIN
  SELECT base_price INTO v_base FROM public.rate_plans WHERE id = p_rate_plan_id;
  IF v_base IS NULL THEN RETURN 0; END IF;

  v_date := p_check_in;
  WHILE v_date < p_check_out LOOP
    v_price := NULL;

    -- 1. Check seasonal rate
    SELECT price INTO v_price FROM public.seasonal_rates
    WHERE rate_plan_id = p_rate_plan_id
      AND v_date >= start_date AND v_date <= end_date
    ORDER BY start_date DESC LIMIT 1;

    -- 2. Check weekday rate
    IF v_price IS NULL THEN
      v_weekday := EXTRACT(DOW FROM v_date)::INT;
      SELECT price INTO v_price FROM public.weekday_rates
      WHERE rate_plan_id = p_rate_plan_id AND weekday = v_weekday;
    END IF;

    -- 3. Fallback to base
    IF v_price IS NULL THEN v_price := v_base; END IF;

    v_total := v_total + v_price;
    v_date := v_date + 1;
  END LOOP;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================
-- RPC: Night Audit
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_run_night_audit(
  p_property_id UUID,
  p_audit_date DATE,
  p_performed_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_total_rooms INT;
  v_occupied INT;
  v_revenue NUMERIC;
  v_occ_rate NUMERIC;
  v_adr NUMERIC;
  v_revpar NUMERIC;
  v_no_shows INT;
BEGIN
  -- Count rooms
  SELECT COUNT(*) INTO v_total_rooms FROM public.rooms
  WHERE property_id = p_property_id AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_occupied FROM public.rooms
  WHERE property_id = p_property_id AND status = 'occupied' AND deleted_at IS NULL;

  -- Mark no-shows
  UPDATE public.reservations SET status = 'no_show'
  WHERE property_id = p_property_id
    AND check_in_date <= p_audit_date
    AND status = 'reserved';
  GET DIAGNOSTICS v_no_shows = ROW_COUNT;

  -- Revenue (closed folios today)
  SELECT COALESCE(SUM(f.total_amount), 0) INTO v_revenue
  FROM public.folios f
  JOIN public.reservations r ON f.reservation_id = r.id
  WHERE r.property_id = p_property_id
    AND f.status = 'closed'
    AND f.updated_at::DATE = p_audit_date;

  -- Calculate metrics
  v_occ_rate := CASE WHEN v_total_rooms > 0 THEN ROUND((v_occupied::NUMERIC / v_total_rooms) * 100, 2) ELSE 0 END;
  v_adr := CASE WHEN v_occupied > 0 THEN ROUND(v_revenue / v_occupied, 2) ELSE 0 END;
  v_revpar := CASE WHEN v_total_rooms > 0 THEN ROUND(v_revenue / v_total_rooms, 2) ELSE 0 END;

  -- Insert audit record
  INSERT INTO public.night_audits (
    property_id, audit_date, total_rooms, occupied_rooms,
    occupancy_rate, total_revenue, adr, revpar, no_shows, performed_by
  ) VALUES (
    p_property_id, p_audit_date, v_total_rooms, v_occupied,
    v_occ_rate, v_revenue, v_adr, v_revpar, v_no_shows, p_performed_by
  )
  ON CONFLICT (property_id, audit_date) DO UPDATE SET
    total_rooms = EXCLUDED.total_rooms,
    occupied_rooms = EXCLUDED.occupied_rooms,
    occupancy_rate = EXCLUDED.occupancy_rate,
    total_revenue = EXCLUDED.total_revenue,
    adr = EXCLUDED.adr,
    revpar = EXCLUDED.revpar,
    no_shows = EXCLUDED.no_shows,
    performed_by = EXCLUDED.performed_by
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RLS POLICIES for new tables
-- =============================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view properties" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage properties" ON public.properties FOR ALL TO authenticated USING (public.is_admin_or_above());

ALTER TABLE public.room_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view inventory" ON public.room_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage inventory" ON public.room_inventory FOR ALL TO authenticated USING (true);

ALTER TABLE public.rate_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view rate_plans" ON public.rate_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage rate_plans" ON public.rate_plans FOR ALL TO authenticated USING (public.is_admin_or_above());

ALTER TABLE public.seasonal_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view seasonal_rates" ON public.seasonal_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage seasonal_rates" ON public.seasonal_rates FOR ALL TO authenticated USING (public.is_admin_or_above());

ALTER TABLE public.weekday_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view weekday_rates" ON public.weekday_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage weekday_rates" ON public.weekday_rates FOR ALL TO authenticated USING (public.is_admin_or_above());

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update payments" ON public.payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete payments" ON public.payments FOR DELETE TO authenticated USING (public.is_admin_or_above());

ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view housekeeping" ON public.housekeeping_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create housekeeping" ON public.housekeeping_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update housekeeping" ON public.housekeeping_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete housekeeping" ON public.housekeeping_tasks FOR DELETE TO authenticated USING (public.is_admin_or_above());

ALTER TABLE public.night_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view night_audits" ON public.night_audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert night_audits" ON public.night_audits FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.channel_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view channel_resv" ON public.channel_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage channel_resv" ON public.channel_reservations FOR ALL TO authenticated USING (true);
