-- =============================================
-- Hotel PMS - Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS (extends Supabase auth.users)
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'admin', 'manager', 'staff')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- BUILDINGS
-- =============================================
CREATE TABLE public.buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- FLOOR_PLANS
-- =============================================
CREATE TABLE public.floor_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ROOM_TYPES
-- =============================================
CREATE TABLE public.room_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ROOMS
-- =============================================
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_number TEXT NOT NULL UNIQUE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE RESTRICT,
  floor_plan_id UUID REFERENCES public.floor_plans(id) ON DELETE SET NULL,
  room_type_id UUID NOT NULL REFERENCES public.room_types(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'out_of_order')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- RATE_GROUPS
-- =============================================
CREATE TABLE public.rate_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- RATE_FORMULAS
-- =============================================
CREATE TABLE public.rate_formulas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_group_id UUID NOT NULL REFERENCES public.rate_groups(id) ON DELETE CASCADE,
  calculation_type TEXT NOT NULL DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'per_night', 'per_person')),
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- MARKET_GROUPS
-- =============================================
CREATE TABLE public.market_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- MARKETS
-- =============================================
CREATE TABLE public.markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_group_id UUID NOT NULL REFERENCES public.market_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- GUEST_TYPES
-- =============================================
CREATE TABLE public.guest_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- NATIONALITIES
-- =============================================
CREATE TABLE public.nationalities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- PASSPORT_TYPES
-- =============================================
CREATE TABLE public.passport_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- VISA_TYPES
-- =============================================
CREATE TABLE public.visa_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- BOOKING_SOURCES
-- =============================================
CREATE TABLE public.booking_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- CHANNELS
-- =============================================
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- DEPARTMENTS
-- =============================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- USER_GROUPS
-- =============================================
CREATE TABLE public.user_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- SPECIAL_SERVICES
-- =============================================
CREATE TABLE public.special_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- FOLIO_GROUPS
-- =============================================
CREATE TABLE public.folio_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ZONE_CODES
-- =============================================
CREATE TABLE public.zone_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_floor_plans_building_id ON public.floor_plans(building_id);
CREATE INDEX idx_rooms_building_id ON public.rooms(building_id);
CREATE INDEX idx_rooms_floor_plan_id ON public.rooms(floor_plan_id);
CREATE INDEX idx_rooms_room_type_id ON public.rooms(room_type_id);
CREATE INDEX idx_rooms_status ON public.rooms(status);
CREATE INDEX idx_room_types_code ON public.room_types(code);
CREATE INDEX idx_rate_formulas_rate_group_id ON public.rate_formulas(rate_group_id);
CREATE INDEX idx_markets_market_group_id ON public.markets(market_group_id);
CREATE INDEX idx_nationalities_country_code ON public.nationalities(country_code);
CREATE INDEX idx_zone_codes_code ON public.zone_codes(code);

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'profiles', 'buildings', 'floor_plans', 'room_types', 'rooms',
      'rate_groups', 'rate_formulas', 'market_groups', 'markets',
      'guest_types', 'nationalities', 'passport_types', 'visa_types',
      'booking_sources', 'channels', 'departments', 'user_groups',
      'special_services', 'folio_groups', 'zone_codes'
    ])
  LOOP
    EXECUTE format('
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    ', t, t);
  END LOOP;
END;
$$;
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
-- =============================================
-- Hotel PMS - Schema V4: Accounting & Forecast
-- Run this AFTER schema_v3.sql
-- =============================================

-- =============================================
-- CHART OF ACCOUNTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'income', 'expense')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert Default GL Accounts
INSERT INTO public.chart_of_accounts (account_code, account_name, type) VALUES
('4000', 'Room Revenue', 'income'),
('4100', 'F&B Revenue', 'income'),
('4200', 'Other Revenue', 'income'),
('2100', 'VAT Payable', 'liability'),
('2200', 'Service Charge Payable', 'liability'),
('1000', 'Cash on Hand', 'asset'),
('1100', 'Credit Card Receivable', 'asset'),
('1200', 'Bank Transfer Receivable', 'asset'),
('1300', 'Guest Ledger (AR)', 'asset')
ON CONFLICT (account_code) DO NOTHING;

-- =============================================
-- PAYMENT METHODS
-- =============================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  accounting_code TEXT NOT NULL REFERENCES public.chart_of_accounts(account_code) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert Default Payment Methods
INSERT INTO public.payment_methods (name, accounting_code) VALUES
('cash', '1000'),
('credit_card', '1100'),
('transfer', '1200')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- FOLIOS (UPDATE EXISTING)
-- =============================================
-- Add new columns to folios
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS folio_number TEXT UNIQUE;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.folios ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Drop tight constraint on status to add 'void'
ALTER TABLE public.folios DROP CONSTRAINT IF EXISTS folios_status_check;
ALTER TABLE public.folios ADD CONSTRAINT folios_status_check
  CHECK (status IN ('open', 'closed', 'void'));

-- Sequence for folio numbers
CREATE SEQUENCE IF NOT EXISTS folio_number_seq START WITH 1000;

CREATE OR REPLACE FUNCTION public.generate_folio_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folio_number IS NULL OR NEW.folio_number = '' THEN
    NEW.folio_number := 'FOL-' || LPAD(nextval('folio_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_folio_number ON public.folios;
CREATE TRIGGER set_folio_number
  BEFORE INSERT ON public.folios
  FOR EACH ROW EXECUTE FUNCTION public.generate_folio_number();

-- Constraint: Cannot close folio if balance != 0
CREATE OR REPLACE FUNCTION public.check_folio_balance_before_close()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    IF NEW.balance != 0 THEN
      RAISE EXCEPTION 'Cannot close folio. Balance must be exactly 0 (current balance is %).', NEW.balance;
    END IF;
    NEW.closed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_folio_balance ON public.folios;
CREATE TRIGGER enforce_folio_balance
  BEFORE UPDATE ON public.folios
  FOR EACH ROW EXECUTE FUNCTION public.check_folio_balance_before_close();

-- =============================================
-- FOLIO_TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.folio_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio_id UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL 
    CHECK (transaction_type IN ('room_charge', 'service', 'tax', 'payment', 'refund')),
  description TEXT NOT NULL,
  debit NUMERIC(10,2) NOT NULL DEFAULT 0,
  credit NUMERIC(10,2) NOT NULL DEFAULT 0,
  reference_no TEXT DEFAULT '',
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Automatically update folio totals when a transaction is inserted
CREATE OR REPLACE FUNCTION public.update_folio_totals_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.folios 
  SET total_amount = total_amount + CASE WHEN NEW.transaction_type IN ('room_charge', 'service') THEN NEW.debit ELSE 0 END,
      tax_amount = tax_amount + CASE WHEN NEW.transaction_type = 'tax' THEN NEW.debit ELSE 0 END,
      balance = balance + NEW.debit - NEW.credit
  WHERE id = NEW.folio_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_folio_totals ON public.folio_transactions;
CREATE TRIGGER update_folio_totals
  AFTER INSERT ON public.folio_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_folio_totals_on_transaction();

-- =============================================
-- ACCOUNT_POSTINGS (Double Entry Ledger)
-- =============================================
CREATE TABLE IF NOT EXISTS public.account_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio_transaction_id UUID NOT NULL REFERENCES public.folio_transactions(id) ON DELETE CASCADE,
  gl_account_code TEXT NOT NULL REFERENCES public.chart_of_accounts(account_code) ON DELETE RESTRICT,
  debit NUMERIC(10,2) NOT NULL DEFAULT 0,
  credit NUMERIC(10,2) NOT NULL DEFAULT 0,
  posted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- RPC: Post Account Transaction
-- =============================================
-- Helper to safely post a transaction + GL records atomically
CREATE OR REPLACE FUNCTION public.rpc_post_account_transaction(
  p_folio_id UUID,
  p_type TEXT,
  p_desc TEXT,
  p_amount NUMERIC,
  p_user_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_trans_id UUID;
  v_debit NUMERIC := 0;
  v_credit NUMERIC := 0;
  v_gl_debit_code TEXT;
  v_gl_credit_code TEXT;
BEGIN
  -- Determine Debit vs Credit
  IF p_type IN ('room_charge', 'service', 'tax') THEN
    v_debit := p_amount;
    v_gl_debit_code := '1300'; -- Guest Ledger AR
    
    IF p_type = 'room_charge' THEN v_gl_credit_code := '4000'; END IF;
    IF p_type = 'service' THEN v_gl_credit_code := '4100'; END IF; -- Or 4200
    IF p_type = 'tax' THEN v_gl_credit_code := '2100'; END IF;
    
  ELSIF p_type IN ('payment') THEN
    v_credit := p_amount;
    v_gl_credit_code := '1300'; -- Guest Ledger AR
    
    -- Lookup payment method's GL code
    SELECT accounting_code INTO v_gl_debit_code 
    FROM public.payment_methods WHERE name = p_payment_method;
    
    IF v_gl_debit_code IS NULL THEN v_gl_debit_code := '1000'; END IF; -- Default to Cash
  END IF;

  -- 1. Insert Folio Transaction
  INSERT INTO public.folio_transactions (
    folio_id, transaction_type, description, debit, credit, posted_by
  ) VALUES (
    p_folio_id, p_type, p_desc, v_debit, v_credit, p_user_id
  ) RETURNING id INTO v_trans_id;

  -- 2. Insert GL Account Postings (Double Entry)
  -- The Debit entry
  IF v_debit > 0 THEN
    INSERT INTO public.account_postings (folio_transaction_id, gl_account_code, debit, credit)
    VALUES (v_trans_id, v_gl_debit_code, v_debit, 0);
    
    INSERT INTO public.account_postings (folio_transaction_id, gl_account_code, debit, credit)
    VALUES (v_trans_id, v_gl_credit_code, 0, v_debit);
  END IF;
  
  -- The Credit entry (Payments)
  IF v_credit > 0 THEN
    INSERT INTO public.account_postings (folio_transaction_id, gl_account_code, debit, credit)
    VALUES (v_trans_id, v_gl_debit_code, v_credit, 0); -- The Bank/Cash increases (debit)
    
    INSERT INTO public.account_postings (folio_transaction_id, gl_account_code, debit, credit)
    VALUES (v_trans_id, v_gl_credit_code, 0, v_credit); -- The AR decreases (credit)
  END IF;

  RETURN v_trans_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================
-- FORECASTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  total_rooms INT NOT NULL DEFAULT 0,
  expected_occupancy INT NOT NULL DEFAULT 0,
  expected_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  occupancy_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  adr NUMERIC(10,2) NOT NULL DEFAULT 0,
  revpar NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, forecast_date)
);

-- =============================================
-- FORECAST_SUMMARY_VIEW (Matches KFO Logic)
-- Combines booked reservations with historical trends
-- =============================================
CREATE OR REPLACE VIEW public.forecast_summary_view AS
WITH FutureBooks AS (
  SELECT 
    r.property_id,
    d.date as forecast_date,
    COUNT(r.id) as booked_rooms,
    COALESCE(SUM(r.rate), 0) as booked_revenue
  FROM generate_series(CURRENT_DATE, CURRENT_DATE + interval '90 days', '1 day'::interval) d(date)
  LEFT JOIN public.reservations r 
    ON r.check_in_date <= d.date::date AND r.check_out_date > d.date::date AND r.status IN ('reserved', 'checked_in')
  GROUP BY r.property_id, d.date
),
HistoricalAvg AS (
  -- 3 month rolling average
  SELECT 
    property_id,
    AVG(occupied_rooms) as avg_occ_rooms,
    AVG(total_revenue) as avg_daily_revenue
  FROM public.night_audits
  WHERE audit_date >= CURRENT_DATE - interval '90 days'
  GROUP BY property_id
)
SELECT 
  fb.property_id,
  fb.forecast_date,
  (SELECT COUNT(id) FROM public.rooms WHERE property_id = fb.property_id AND status != 'out_of_order') as total_rooms,
  GREATEST(fb.booked_rooms, COALESCE(ha.avg_occ_rooms, 0)) as expected_occupancy,
  GREATEST(fb.booked_revenue, COALESCE(ha.avg_daily_revenue, 0)) as expected_revenue
FROM FutureBooks fb
LEFT JOIN HistoricalAvg ha ON fb.property_id = ha.property_id
WHERE fb.property_id IS NOT NULL;


-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view chart_of_accounts" ON public.chart_of_accounts FOR SELECT TO authenticated USING (true);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view payment_methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);

ALTER TABLE public.folio_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view folio_transactions" ON public.folio_transactions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.account_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view account_postings" ON public.account_postings FOR SELECT TO authenticated USING (true);

ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view forecasts" ON public.forecasts FOR SELECT TO authenticated USING (true);
-- =============================================
-- Hotel PMS - Schema V4.1: Night Audit Accounting Update
-- Run this AFTER schema_v4_accounting.sql
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
  
  -- Cursor for folios that need room charges posted
  v_res RECORD;
  v_daily_rate NUMERIC;
  v_tax NUMERIC;
  v_service NUMERIC;
  v_folio_id UUID;
BEGIN
  -- 1. Post Room Charges for all Checked-In Reservations
  FOR v_res IN 
    SELECT r.id, r.rate, f.id as folio_id
    FROM public.reservations r
    JOIN public.folios f ON f.reservation_id = r.id
    WHERE r.property_id = p_property_id 
      AND r.status = 'checked_in'
      AND r.check_in_date <= p_audit_date
      AND r.check_out_date > p_audit_date
  LOOP
    v_daily_rate := v_res.rate;
    -- Assume standard 10% Service Charge and 7% VAT on the base rate
    -- E.g. base = 1000, SVC = 100, VAT = 77
    v_service := ROUND(v_daily_rate * 0.10, 2);
    v_tax := ROUND((v_daily_rate + v_service) * 0.07, 2);
    
    -- Post Room Charge
    PERFORM public.rpc_post_account_transaction(
      v_res.folio_id, 'room_charge', 'Room Charge for ' || p_audit_date::text, v_daily_rate, p_performed_by, NULL
    );
    
    -- Post Service Charge
    PERFORM public.rpc_post_account_transaction(
      v_res.folio_id, 'service', 'Service Charge 10%', v_service, p_performed_by, NULL
    );
    
    -- Post VAT
    PERFORM public.rpc_post_account_transaction(
      v_res.folio_id, 'tax', 'VAT 7%', v_tax, p_performed_by, NULL
    );
  END LOOP;

  -- 2. Count rooms
  SELECT COUNT(*) INTO v_total_rooms FROM public.rooms
  WHERE property_id = p_property_id AND deleted_at IS NULL AND status != 'out_of_order';

  SELECT COUNT(*) INTO v_occupied FROM public.rooms
  WHERE property_id = p_property_id AND status = 'occupied' AND deleted_at IS NULL;

  -- 3. Mark no-shows
  UPDATE public.reservations SET status = 'no_show'
  WHERE property_id = p_property_id
    AND check_in_date <= p_audit_date
    AND status = 'reserved';
  GET DIAGNOSTICS v_no_shows = ROW_COUNT;

  -- 4. Revenue (Total unearned revenue moved to earned via room_charges today)
  -- Or just sum all 'room_charge' transactions posted today
  SELECT COALESCE(SUM(debit), 0) INTO v_revenue
  FROM public.folio_transactions ft
  JOIN public.folios f ON ft.folio_id = f.id
  JOIN public.reservations r ON f.reservation_id = r.id
  WHERE r.property_id = p_property_id
    AND ft.transaction_type = 'room_charge'
    AND ft.posted_at::DATE = p_audit_date;

  -- 5. Calculate metrics
  v_occ_rate := CASE WHEN v_total_rooms > 0 THEN ROUND((v_occupied::NUMERIC / v_total_rooms) * 100, 2) ELSE 0 END;
  v_adr := CASE WHEN v_occupied > 0 THEN ROUND(v_revenue / v_occupied, 2) ELSE 0 END;
  v_revpar := CASE WHEN v_total_rooms > 0 THEN ROUND(v_revenue / v_total_rooms, 2) ELSE 0 END;

  -- 6. Insert audit record
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
-- ==========================================
-- Phase 5: Daily Revenue Summary View
-- Replicates the Legacy KFO "Manager Report"
-- ==========================================

CREATE OR REPLACE VIEW daily_revenue_summary AS
WITH daily_transactions AS (
    SELECT 
        DATE(posted_at) as revenue_date,
        transaction_type,
        SUM(amount) as net_amount,
        SUM(tax_amount) as tax_amount,
        SUM(service_charge) as service_charge,
        SUM(total_amount) as gross_amount
    FROM 
        folio_transactions
    WHERE 
        -- Only count actual debits as revenue (charges)
        transaction_type IN ('room_charge', 'service') 
        -- Ignore raw taxes and payments as they are balance sheet items, not revenue categories directly, but tax_amount generated from room_charge is captured above 
    GROUP BY 
        DATE(posted_at),
        transaction_type
),
payments_summary AS (
    SELECT 
        DATE(posted_at) as revenue_date,
        'payment_collected' as transaction_type,
        0 as net_amount,
        0 as tax_amount,
        0 as service_charge,
        SUM(amount) as gross_amount -- Payments are logged as Credits (negative), but we sum absolute for reporting collection
    FROM 
        folio_transactions
    WHERE 
        transaction_type = 'payment'
    GROUP BY 
        DATE(posted_at)
)
SELECT * FROM daily_transactions
UNION ALL
SELECT * FROM payments_summary
ORDER BY revenue_date DESC, transaction_type ASC;

COMMENT ON VIEW daily_revenue_summary IS 'Aggregates folio transactions by date and type to support the Daily Manager Revenue Report.';

-- ==========================================
-- Trial Balance (Credits vs Debits) View
-- ==========================================
CREATE OR REPLACE VIEW trial_balance_report AS
SELECT 
    gl.account_type,
    gl.account_code,
    gl.account_name,
    SUM(ap.debit_amount) as total_debit,
    SUM(ap.credit_amount) as total_credit,
    SUM(ap.debit_amount - ap.credit_amount) as net_balance
FROM 
    chart_of_accounts gl
LEFT JOIN 
    account_postings ap ON gl.id = ap.account_id
GROUP BY 
    gl.account_type, gl.account_code, gl.account_name
ORDER BY 
    gl.account_type DESC, gl.account_code ASC;

-- ==========================================
-- Guest Ledger View (In-house Folio Balances)
-- ==========================================
CREATE OR REPLACE VIEW guest_ledger_report AS
SELECT 
    f.id as folio_id,
    f.folio_number,
    r.reservation_number,
    p.full_name as guest_name,
    rm.room_number,
    r.check_in_date,
    r.check_out_date,
    SUM(ft.amount) as room_charges,
    SUM(ft.tax_amount) as taxes,
    SUM(ft.service_charge) as service_charges,
    SUM(ft.total_amount) as total_charges,
    (SELECT SUM(amount) FROM folio_transactions WHERE transaction_type = 'payment' AND folio_id = f.id) as payments,
    f.balance as current_balance
FROM 
    folios f
JOIN 
    reservations r ON f.reservation_id = r.id
JOIN 
    profiles p ON r.guest_id = p.id
JOIN 
    rooms rm ON r.room_id = rm.id
LEFT JOIN 
    folio_transactions ft ON f.id = ft.folio_id AND ft.transaction_type IN ('room_charge', 'service')
WHERE 
    f.status = 'open' AND r.status IN ('checked_in', 'checked_out')
GROUP BY 
    f.id, f.folio_number, r.reservation_number, p.full_name, rm.room_number, r.check_in_date, r.check_out_date, f.balance
ORDER BY 
    rm.room_number ASC;

-- ==========================================
-- Aging Report View (City Ledger Overdue Accounts)
-- ==========================================
CREATE OR REPLACE VIEW aging_report AS
SELECT 
    f.id as folio_id,
    f.folio_number,
    p.full_name as account_name,
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
    folios f
JOIN 
    reservations r ON f.reservation_id = r.id
JOIN 
    profiles p ON r.guest_id = p.id
WHERE 
    f.status = 'closed' AND f.balance > 0
ORDER BY 
    days_overdue DESC;
-- =============================================
-- Phase 6: Operational Row Level Security (RLS)
-- Multi-Property Data Isolation
-- =============================================

-- 1. Add property_id to Profiles for explicit tenant mapping if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='property_id') THEN
        ALTER TABLE public.profiles ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;
        
        -- Fallback: Assign all existing profiles to the default MAIN property
        UPDATE public.profiles SET property_id = (SELECT id FROM public.properties WHERE code = 'MAIN' LIMIT 1) WHERE property_id IS NULL;
    END IF;
END $$;

-- 2. Helper function to fetch the current user's property_id context
CREATE OR REPLACE FUNCTION public.get_user_property_id()
RETURNS UUID AS $$
  SELECT property_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Apply Multi-Tenant RLS to Core Operational Tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'reservations', 'folios', 'folio_transactions', 'payments',
      'account_postings', 'night_audits', 'housekeeping_tasks', 
      'channel_reservations', 'room_inventory'
    ])
  LOOP
    -- Enable RLS natively
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- SELECT: users can view records belonging strictly to their assigned property (Super Admins can view all)
    EXECUTE format('
      CREATE POLICY "Users can view %I in their property"
        ON public.%I FOR SELECT
        TO authenticated
        USING (property_id = public.get_user_property_id() OR public.is_admin_or_above());
    ', t, t);

    -- INSERT: users can insert into their property records
    EXECUTE format('
      CREATE POLICY "Users can create %I in their property"
        ON public.%I FOR INSERT
        TO authenticated
        WITH CHECK (property_id = public.get_user_property_id() OR public.is_admin_or_above());
    ', t, t);

    -- UPDATE: users can update their property records
    EXECUTE format('
      CREATE POLICY "Users can update %I in their property"
        ON public.%I FOR UPDATE
        TO authenticated
        USING (property_id = public.get_user_property_id() OR public.is_admin_or_above());
    ', t, t);

    -- DELETE: Admins only can delete operational data
    EXECUTE format('
      CREATE POLICY "Admins can delete %I"
        ON public.%I FOR DELETE
        TO authenticated
        USING (public.is_admin_or_above());
    ', t, t);
  END LOOP;
END;
$$;
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
-- =============================================
-- Hotel PMS - Row Level Security Policies
-- Run this in Supabase SQL Editor AFTER schema.sql
-- =============================================

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is admin+
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- PROFILES
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_above());

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_above());

-- =============================================
-- MACRO: Apply standard RLS to master data tables
-- All authenticated users can read, admins can write
-- =============================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'buildings', 'floor_plans', 'room_types', 'rooms',
      'rate_groups', 'rate_formulas', 'market_groups', 'markets',
      'guest_types', 'nationalities', 'passport_types', 'visa_types',
      'booking_sources', 'channels', 'departments', 'user_groups',
      'special_services', 'folio_groups', 'zone_codes'
    ])
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- SELECT: all authenticated users
    EXECUTE format('
      CREATE POLICY "Authenticated users can view %I"
        ON public.%I FOR SELECT
        TO authenticated
        USING (true);
    ', t, t);

    -- INSERT: admins only
    EXECUTE format('
      CREATE POLICY "Admins can create %I"
        ON public.%I FOR INSERT
        TO authenticated
        WITH CHECK (public.is_admin_or_above());
    ', t, t);

    -- UPDATE: admins only
    EXECUTE format('
      CREATE POLICY "Admins can update %I"
        ON public.%I FOR UPDATE
        TO authenticated
        USING (public.is_admin_or_above());
    ', t, t);

    -- DELETE: admins only
    EXECUTE format('
      CREATE POLICY "Admins can delete %I"
        ON public.%I FOR DELETE
        TO authenticated
        USING (public.is_admin_or_above());
    ', t, t);
  END LOOP;
END;
$$;
