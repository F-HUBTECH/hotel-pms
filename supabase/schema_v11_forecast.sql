-- =============================================
-- Hotel PMS - Schema V11: Forecast
-- KFO Parity - Room-by-Room Forecast Grid
-- =============================================

-- =============================================
-- 1. FORECAST CONFIGURATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.forecast_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,

  -- Display name
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Forecast settings
  forecast_days INT NOT NULL DEFAULT 30,
  forecast_type TEXT NOT NULL DEFAULT 'room_by_room'
    CHECK (forecast_type IN ('summary', 'room_by_room', 'by_room_type', 'by_building')),

  -- Seasonality settings
  include_weekend_premium BOOLEAN NOT NULL DEFAULT true,
  include_holiday_premium BOOLEAN NOT NULL DEFAULT true,
  weekend_premium_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  holiday_premium_rate NUMERIC(5,2) NOT NULL DEFAULT 30.00,

  -- Room status handling
  include_oo_rooms BOOLEAN NOT NULL DEFAULT FALSE,
  include_oi_rooms BOOLEAN NOT NULL DEFAULT FALSE,
  include_hu_rooms BOOLEAN NOT NULL DEFAULT TRUE,

  -- Display options
  show_revenue BOOLEAN NOT NULL DEFAULT true,
  show_pax BOOLEAN NOT NULL DEFAULT true,
  fit_grp_breakdown BOOLEAN NOT NULL DEFAULT true,

  -- Created/Updated
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(property_id, name)
);

CREATE INDEX IF NOT EXISTS idx_forecast_configurations_property
  ON public.forecast_configurations(property_id);
CREATE INDEX IF NOT EXISTS idx_forecast_configurations_active
  ON public.forecast_configurations(is_active);

-- =============================================
-- 2. ROOM STATUS DATES
-- =============================================
CREATE TABLE IF NOT EXISTS public.room_status_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,

  -- Status type: OO=Out of Order, OI=Out of Inventory, HU=House Use
  status_type TEXT NOT NULL CHECK (status_type IN ('OO', 'OI', 'HU')),

  -- Date range for the status
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,

  -- Reason/documentation
  reason TEXT NOT NULL DEFAULT '',
  notes TEXT,

  -- Audit
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT room_status_dates_valid_dates CHECK (to_date >= from_date)
);

CREATE INDEX IF NOT EXISTS idx_room_status_dates_room
  ON public.room_status_dates(room_id);
CREATE INDEX IF NOT EXISTS idx_room_status_dates_date_range
  ON public.room_status_dates(from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_room_status_dates_status_type
  ON public.room_status_dates(status_type);

-- =============================================
-- 3. CORPORATE ALLOTMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.corporate_allotments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Allotment code and details
  allot_code TEXT NOT NULL UNIQUE,
  allot_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',

  -- Room allocation
  room_type_id UUID REFERENCES public.room_types(id) ON DELETE SET NULL,
  guaranteed_rooms INT NOT NULL DEFAULT 0,

  -- Rate information
  rate_code TEXT REFERENCES public.revenue_transaction_codes(code) ON DELETE SET NULL,
  rate_amount NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Contract period
  contract_start_date DATE NOT NULL,
  contract_end_date DATE,

  -- Contact information
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT,
  contact_phone TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,

  -- Audit
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corporate_allotments_code
  ON public.corporate_allotments(allot_code);
CREATE INDEX IF NOT EXISTS idx_corporate_allotments_room_type
  ON public.corporate_allotments(room_type_id);
CREATE INDEX IF NOT EXISTS idx_corporate_allotments_active
  ON public.corporate_allotments(is_active);

-- =============================================
-- 4. FORECAST ROOM DAILY (CORE)
-- =============================================
CREATE TABLE IF NOT EXISTS public.forecast_room_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Date and room reference
  forecast_date DATE NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
  room_type_id UUID REFERENCES public.room_types(id) ON DELETE SET NULL,

  -- Booking information
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  booking_status TEXT CHECK (booking_status IN ('B', 'I', 'C', 'O', 'X')),

  -- Guest/Segment information
  guest_type TEXT CHECK (guest_type IN ('FIT', 'GRP', 'HOUSE')),
  pax_adults INT NOT NULL DEFAULT 0,
  pax_children INT NOT NULL DEFAULT 0,

  -- Rate information
  rate_code TEXT REFERENCES public.revenue_transaction_codes(code) ON DELETE SET NULL,
  rate_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  allot_code TEXT REFERENCES public.corporate_allotments(allot_code) ON DELETE SET NULL,

  -- Calculated fields
  expected_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_room_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_extra_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Total revenue (calculated)
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Room status
  room_status TEXT CHECK (room_status IN ('available', 'occupied', 'oo', 'oi', 'hu')),

  -- Forecast type
  forecast_type TEXT CHECK (forecast_type IN ('confirmed', 'projected')) DEFAULT 'projected',

  -- Manual adjustments
  is_override BOOLEAN NOT NULL DEFAULT FALSE,
  original_rate_amount NUMERIC(10,2),
  original_revenue NUMERIC(12,2),
  override_reason TEXT,
  override_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  override_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(forecast_date, room_id)
);

CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_date
  ON public.forecast_room_daily(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_room
  ON public.forecast_room_daily(room_id);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_status
  ON public.forecast_room_daily(booking_status);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_building
  ON public.forecast_room_daily(building_id);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_type
  ON public.forecast_room_daily(room_type_id);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_reservation
  ON public.forecast_room_daily(reservation_id);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_type_status
  ON public.forecast_room_daily(forecast_type);

-- =============================================
-- 5. FORECAST SUMMARY DAILY
-- =============================================
CREATE TABLE IF NOT EXISTS public.forecast_summary_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Date and property
  forecast_date DATE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,

  -- Room counts
  total_rooms INT NOT NULL,
  available_rooms INT NOT NULL,
  occupied_rooms INT NOT NULL,
  stayover_rooms INT NOT NULL,
  arrival_rooms INT NOT NULL,
  departure_rooms INT NOT NULL,

  -- Room status breakdown
  oo_rooms INT NOT NULL DEFAULT 0,      -- Out of Order
  oi_rooms INT NOT NULL DEFAULT 0,      -- Out of Inventory
  hu_rooms INT NOT NULL DEFAULT 0,      -- House Use
  complimentary_rooms INT NOT NULL DEFAULT 0,

  -- Occupancy metrics
  occupancy_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  rooms_sold INT NOT NULL DEFAULT 0,        -- OCR (Occupancy vs Rooms Sold)

  -- Revenue breakdown
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  room_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Segment breakdown
  fit_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  grp_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- KPIs
  adr NUMERIC(10,2) NOT NULL DEFAULT 0,
  revpar NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Comparison with actuals (future-proof)
  actual_rooms_sold INT,
  actual_revenue NUMERIC(12,2),
  actual_adr NUMERIC(10,2),
  actual_revpar NUMERIC(10,2),
  revenue_variance NUMERIC(12,2),
  variance_percentage NUMERIC(5,2),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(forecast_date, property_id)
);

CREATE INDEX IF NOT EXISTS idx_forecast_summary_daily_date
  ON public.forecast_summary_daily(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecast_summary_daily_property
  ON public.forecast_summary_daily(property_id);

-- =============================================
-- 6. HELPER FUNCTIONS
-- =============================================

-- Get room status for a given date and room
CREATE OR REPLACE FUNCTION public.get_room_status_for_date(
  p_room_id UUID,
  p_date DATE
)
RETURNS TABLE(
  status_type TEXT,
  status_description TEXT,
  is_available BOOLEAN
) AS $$
DECLARE
  v_status_record RECORD;
  v_is_available BOOLEAN := TRUE;
BEGIN
  -- Check for OO (Out of Order)
  SELECT INTO v_status_record
    FROM room_status_dates rsd
  WHERE rsd.room_id = p_room_id
      AND rsd.status_type = 'OO'
      AND rsd.from_date <= p_date
      AND rsd.to_date >= p_date;

  IF v_status_record IS NOT NULL THEN
    v_is_available := FALSE;
    RETURN QUERY SELECT 'OO', 'Out of Order: ' || v_status_record.reason, FALSE;
  END IF;

  -- Check for OI (Out of Inventory)
  SELECT INTO v_status_record
    FROM room_status_dates rsd
    WHERE rsd.room_id = p_room_id
      AND rsd.status_type = 'OI'
      AND rsd.from_date <= p_date
      AND rsd.to_date >= p_date;

  IF v_status_record IS NOT NULL THEN
    v_is_available := FALSE;
    RETURN QUERY SELECT 'OI', 'Out of Inventory: ' || v_status_record.reason, FALSE;
  END IF;

  RETURN QUERY SELECT NULL, NULL, v_is_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if room is occupied on a given date
CREATE OR REPLACE FUNCTION public.is_room_occupied_on_date(
  p_room_id UUID,
  p_date DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM forecast_room_daily frd
  JOIN reservations r ON r.id = frd.reservation_id
  WHERE frd.room_id = p_room_id
    AND frd.forecast_date = p_date
    AND frd.booking_status IN ('B', 'I')  -- Booked or In-house
    AND frd.room_status = 'occupied';

  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get weekend/holiday premium
CREATE OR REPLACE FUNCTION public.get_date_premium(
  p_date DATE,
  p_include_weekend BOOLEAN,
  p_include_holiday BOOLEAN,
  p_weekend_rate NUMERIC,
  p_holiday_rate NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_is_weekend BOOLEAN;
  v_dow INT;
  v_premium NUMERIC(5,2) := 0;
BEGIN
  v_dow := EXTRACT(ISODOW FROM p_date);
  v_is_weekend := v_dow IN (0, 6);  -- Sunday or Saturday

  v_premium := 0;

  IF p_include_weekend AND v_is_weekend THEN
    v_premium := v_premium + p_weekend_rate;
  END IF;

  -- Note: Holiday check would require a holidays table
  -- For now, just weekend premium

  RETURN v_premium / 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get effective rate for a forecast item
CREATE OR REPLACE FUNCTION public.get_effective_forecast_rate(
  p_base_rate NUMERIC,
  p_premium NUMERIC
)
RETURNS NUMERIC AS $$
BEGIN
  RETURN p_base_rate * (1 + p_premium);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 7. RLS POLICIES
-- =============================================

ALTER TABLE public.forecast_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read forecast config"
  ON public.forecast_configurations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify forecast config"
  ON public.forecast_configurations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

ALTER TABLE public.room_status_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read room status"
  ON public.room_status_dates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify room status"
  ON public.room_status_dates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

ALTER TABLE public.corporate_allotments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read allotments"
  ON public.corporate_allotments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify allotments"
  ON public.corporate_allotments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

ALTER TABLE public.forecast_room_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read forecast"
  ON public.forecast_room_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify forecast"
  ON public.forecast_room_daily FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

ALTER TABLE public.forecast_summary_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read summary"
  ON public.forecast_summary_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify summary"
  ON public.forecast_summary_daily FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

-- =============================================
-- 8. INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_booking_status_date
  ON public.forecast_room_daily(booking_status, forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_guest_type
  ON public.forecast_room_daily(guest_type);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_forecast_type
  ON public.forecast_room_daily(forecast_type);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_override
  ON public.forecast_room_daily(is_override);

-- =============================================
-- DONE - Schema V11: Forecast
-- =============================================
