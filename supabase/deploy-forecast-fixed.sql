-- =============================================
-- Hotel PMS - Complete Forecast Deployment (FIXED)
-- Schema V11: Forecast (KFO Parity)
-- =============================================
-- Run this entire file in Supabase SQL Editor:
-- https://app.supabase.com/project/rbpiwglmpahwvabzcgzr/sql/new
-- =============================================

-- =============================================
-- PART 1: TABLES (Schema V11)
-- =============================================

-- 1. FORECAST CONFIGURATIONS
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

CREATE INDEX IF NOT EXISTS idx_forecast_configurations_property ON public.forecast_configurations(property_id);
CREATE INDEX IF NOT EXISTS idx_forecast_configurations_active ON public.forecast_configurations(is_active);

-- 2. ROOM STATUS DATES
CREATE TABLE IF NOT EXISTS public.room_status_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,

  -- Status type: OO=Out of Order, OI=Out of Inventory, HU=House Use
  status_type TEXT NOT NULL CHECK (status_type IN ('OO', 'OI', 'HU')),

  -- Date range for status
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

CREATE INDEX IF NOT EXISTS idx_room_status_dates_room ON public.room_status_dates(room_id);
CREATE INDEX IF NOT EXISTS idx_room_status_dates_date_range ON public.room_status_dates(from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_room_status_dates_status_type ON public.room_status_dates(status_type);

-- 3. CORPORATE ALLOTMENTS
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

CREATE INDEX IF NOT EXISTS idx_corporate_allotments_code ON public.corporate_allotments(allot_code);
CREATE INDEX IF NOT EXISTS idx_corporate_allotments_room_type ON public.corporate_allotments(room_type_id);
CREATE INDEX IF NOT EXISTS idx_corporate_allotments_active ON public.corporate_allotments(is_active);

-- 4. FORECAST ROOM DAILY (CORE)
CREATE TABLE IF NOT EXISTS public.forecast_room_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Date and room reference
  forecast_date DATE NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  building_id UUID REFERENCES public.buildings(id),
  room_type_id UUID REFERENCES public.room_types(id),

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

CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_date ON public.forecast_room_daily(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_room ON public.forecast_room_daily(room_id);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_status ON public.forecast_room_daily(booking_status);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_building ON public.forecast_room_daily(building_id);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_type ON public.forecast_room_daily(room_type_id);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_reservation ON public.forecast_room_daily(reservation_id);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_type_status ON public.forecast_room_daily(forecast_type);
CREATE INDEX IF NOT EXISTS idx_forecast_room_daily_override ON public.forecast_room_daily(is_override);

-- 5. FORECAST SUMMARY DAILY
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
  oo_rooms INT NOT NULL DEFAULT 0,
  oi_rooms INT NOT NULL DEFAULT 0,
  hu_rooms INT NOT NULL DEFAULT 0,
  complimentary_rooms INT NOT NULL DEFAULT 0,

  -- Occupancy metrics
  occupancy_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  rooms_sold INT NOT NULL DEFAULT 0,

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

CREATE INDEX IF NOT EXISTS idx_forecast_summary_daily_date ON public.forecast_summary_daily(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecast_summary_daily_property ON public.forecast_summary_daily(property_id);

-- =============================================
-- PART 2: HELPER FUNCTIONS
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
  SELECT * INTO v_status_record
    FROM public.room_status_dates rsd
  WHERE rsd.room_id = p_room_id
      AND rsd.status_type = 'OO'
      AND rsd.from_date <= p_date
      AND rsd.to_date >= p_date;

  IF v_status_record IS NOT NULL THEN
    v_is_available := FALSE;
    RETURN QUERY SELECT 'OO', 'Out of Order: ' || v_status_record.reason, FALSE;
  END IF;

  -- Check for OI (Out of Inventory)
  SELECT * INTO v_status_record
    FROM public.room_status_dates rsd
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
  v_is_weekend := v_dow IN (0, 6);

  v_premium := 0;

  IF p_include_weekend AND v_is_weekend THEN
    v_premium := v_premium + p_weekend_rate;
  END IF;

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
-- PART 3: RPC FUNCTIONS
-- =============================================

-- RPC: GENERATE DAILY FORECAST
CREATE OR REPLACE FUNCTION public.rpc_generate_daily_forecast(
  p_start_date DATE,
  p_end_date DATE,
  p_property_id UUID DEFAULT NULL,
  p_config_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_date DATE;
  v_config RECORD;
  v_total_days INT;
  v_result JSONB;
BEGIN
  -- Get forecast configuration
  IF p_config_id IS NOT NULL THEN
    SELECT * INTO v_config FROM public.forecast_configurations WHERE id = p_config_id;
  ELSE
    SELECT * INTO v_config FROM public.forecast_configurations
      WHERE is_active = TRUE AND (p_property_id IS NULL OR property_id = p_property_id)
      LIMIT 1;
  END IF;

  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No forecast configuration found'
    );
  END IF;

  v_total_days := p_end_date - p_start_date + 1;

  -- Build result array
  v_result := jsonb_build_array();

  FOR v_current_date IN SELECT generate_series(p_start_date, p_end_date, INTERVAL '1 day')::DATE
  LOOP
    -- Generate room-by-room forecast for this date
    INSERT INTO public.forecast_room_daily (
      forecast_date,
      room_id,
      building_id,
      room_type_id,
      reservation_id,
      booking_status,
      guest_type,
      pax_adults,
      pax_children,
      rate_code,
      rate_amount,
      allot_code,
      expected_revenue,
      expected_room_revenue,
      expected_extra_revenue,
      total_revenue,
      room_status,
      forecast_type,
      created_at,
      updated_at
    )
    SELECT
      v_current_date::DATE,
      r.id,
      r.building_id,
      r.room_type_id,
      res.id,
      CASE
        WHEN res.id IS NULL THEN NULL
        WHEN res.check_in_date <= v_current_date AND res.check_out_date > v_current_date THEN
          CASE
            WHEN res.status = 'reserved' THEN 'B'
            WHEN res.status = 'checked_in' THEN 'I'
            ELSE 'B'
          END
        WHEN res.check_out_date = v_current_date THEN 'O'
        ELSE NULL
      END AS booking_status,
      CASE
        WHEN res.group_id IS NOT NULL THEN 'GRP'
        WHEN res.id IS NOT NULL THEN 'FIT'
        ELSE NULL
      END AS guest_type,
      COALESCE(res.adults, 0),
      COALESCE(res.children, 0),
      tc.code AS rate_code,
      CASE
        WHEN v_config.include_weekend_premium THEN
          r.rate * (1 + get_date_premium(v_current_date, TRUE, v_config.include_holiday_premium,
                                             v_config.weekend_premium_rate, v_config.holiday_premium_rate))
        ELSE r.rate
      END AS rate_amount,
      CASE
        WHEN res.id IS NOT NULL THEN
          CASE
            WHEN v_config.include_weekend_premium THEN
              r.rate * (1 + get_date_premium(v_current_date, TRUE, v_config.include_holiday_premium,
                                                 v_config.weekend_premium_rate, v_config.holiday_premium_rate))
            ELSE r.rate
          END
        ELSE 0
      END AS expected_room_revenue,
      0 AS expected_extra_revenue,
      CASE
        WHEN res.id IS NOT NULL THEN
          CASE
            WHEN v_config.include_weekend_premium THEN
              r.rate * (1 + get_date_premium(v_current_date, TRUE, v_config.include_holiday_premium,
                                                 v_config.weekend_premium_rate, v_config.holiday_premium_rate))
            ELSE r.rate
          END
        ELSE 0
      END AS total_revenue,
      CASE
        WHEN NOT v_config.include_oo_rooms AND (
          SELECT 1 FROM public.room_status_dates rsd
          WHERE rsd.room_id = r.id
            AND rsd.status_type = 'OO'
            AND rsd.from_date <= v_current_date
            AND rsd.to_date >= v_current_date
        ) = 1
        THEN 'oo'
        WHEN NOT v_config.include_oi_rooms AND (
          SELECT 1 FROM public.room_status_dates rsd
          WHERE rsd.room_id = r.id
            AND rsd.status_type = 'OI'
            AND rsd.from_date <= v_current_date
            AND rsd.to_date >= v_current_date
        ) = 1
        THEN 'oi'
        WHEN NOT v_config.include_hu_rooms AND (
          SELECT 1 FROM public.room_status_dates rsd
          WHERE rsd.room_id = r.id
            AND rsd.status_type = 'HU'
            AND rsd.from_date <= v_current_date
            AND rsd.to_date >= v_current_date
        ) = 1
        THEN 'hu'
        WHEN res.id IS NOT NULL THEN 'occupied'
        ELSE 'available'
      END AS room_status,
      CASE
        WHEN res.id IS NOT NULL THEN 'confirmed'
        ELSE 'projected'
      END AS forecast_type,
      NOW(),
      NOW()
    FROM public.rooms r
    LEFT JOIN public.reservations res ON r.id = res.room_id
      AND res.status IN ('reserved', 'checked_in')
      AND res.check_in_date <= v_current_date
      AND res.check_out_date > v_current_date
    LEFT JOIN public.room_types rt ON r.room_type_id = rt.id
    LEFT JOIN public.revenue_transaction_codes tc ON rt.default_rate_code = tc.code
    LEFT JOIN public.corporate_allotments ca ON res.allotment_code = ca.allot_code
    ON CONFLICT (forecast_date, room_id) DO UPDATE SET
      reservation_id = EXCLUDED.reservation_id,
      booking_status = EXCLUDED.booking_status,
      guest_type = EXCLUDED.guest_type,
      pax_adults = EXCLUDED.pax_adults,
      pax_children = EXCLUDED.pax_children,
      rate_code = EXCLUDED.rate_code,
      rate_amount = EXCLUDED.rate_amount,
      allot_code = EXCLUDED.allot_code,
      expected_revenue = EXCLUDED.expected_revenue,
      expected_room_revenue = EXCLUDED.expected_room_revenue,
      expected_extra_revenue = EXCLUDED.expected_extra_revenue,
      total_revenue = EXCLUDED.total_revenue,
      room_status = EXCLUDED.room_status,
      forecast_type = EXCLUDED.forecast_type,
      updated_at = NOW();

    -- Generate daily summary
    INSERT INTO public.forecast_summary_daily (
      forecast_date,
      property_id,
      total_rooms,
      available_rooms,
      occupied_rooms,
      stayover_rooms,
      arrival_rooms,
      departure_rooms,
      oo_rooms,
      oi_rooms,
      hu_rooms,
      complimentary_rooms,
      occupancy_percentage,
      rooms_sold,
      total_revenue,
      room_revenue,
      extra_revenue,
      fit_revenue,
      grp_revenue,
      adr,
      revpar,
      created_at,
      updated_at
    )
    SELECT
      v_current_date::DATE,
      COALESCE(p_property_id, (SELECT id FROM public.properties LIMIT 1)),
      COUNT(*) AS total_rooms,
      COUNT(*) FILTER (WHERE room_status = 'available') AS available_rooms,
      COUNT(*) FILTER (WHERE room_status = 'occupied') AS occupied_rooms,
      COUNT(*) FILTER (WHERE booking_status = 'I') AS stayover_rooms,
      COUNT(*) FILTER (WHERE booking_status = 'B') AS arrival_rooms,
      COUNT(*) FILTER (WHERE booking_status = 'O') AS departure_rooms,
      COUNT(*) FILTER (WHERE room_status = 'oo') AS oo_rooms,
      COUNT(*) FILTER (WHERE room_status = 'oi') AS oi_rooms,
      COUNT(*) FILTER (WHERE room_status = 'hu') AS hu_rooms,
      0 AS complimentary_rooms,
      CASE
        WHEN COUNT(*) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE room_status = 'occupied')::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
        ELSE 0
      END AS occupancy_percentage,
      COUNT(*) FILTER (WHERE room_status = 'occupied') AS rooms_sold,
      COALESCE(SUM(total_revenue), 0) AS total_revenue,
      COALESCE(SUM(expected_room_revenue), 0) AS room_revenue,
      COALESCE(SUM(expected_extra_revenue), 0) AS extra_revenue,
      COALESCE(SUM(total_revenue) FILTER (WHERE guest_type = 'FIT'), 0) AS fit_revenue,
      COALESCE(SUM(total_revenue) FILTER (WHERE guest_type = 'GRP'), 0) AS grp_revenue,
      CASE
        WHEN COUNT(*) FILTER (WHERE room_status = 'occupied') > 0 THEN
          ROUND(SUM(total_revenue) / COUNT(*) FILTER (WHERE room_status = 'occupied'), 2)
        ELSE 0
      END AS adr,
      CASE
        WHEN COUNT(*) > 0 THEN
          ROUND(SUM(total_revenue) / COUNT(*), 2)
        ELSE 0
      END AS revpar,
      NOW(),
      NOW()
    FROM public.forecast_room_daily frd
    WHERE frd.forecast_date = v_current_date::DATE
      AND (p_property_id IS NULL OR building_id IN (SELECT id FROM public.buildings WHERE property_id = p_property_id))
    ON CONFLICT (forecast_date, property_id) DO UPDATE SET
      total_rooms = EXCLUDED.total_rooms,
      available_rooms = EXCLUDED.available_rooms,
      occupied_rooms = EXCLUDED.occupied_rooms,
      stayover_rooms = EXCLUDED.stayover_rooms,
      arrival_rooms = EXCLUDED.arrival_rooms,
      departure_rooms = EXCLUDED.departure_rooms,
      oo_rooms = EXCLUDED.oo_rooms,
      oi_rooms = EXCLUDED.oi_rooms,
      hu_rooms = EXCLUDED.hu_rooms,
      occupancy_percentage = EXCLUDED.occupancy_percentage,
      rooms_sold = EXCLUDED.rooms_sold,
      total_revenue = EXCLUDED.total_revenue,
      room_revenue = EXCLUDED.room_revenue,
      extra_revenue = EXCLUDED.extra_revenue,
      fit_revenue = EXCLUDED.fit_revenue,
      grp_revenue = EXCLUDED.grp_revenue,
      adr = EXCLUDED.adr,
      revpar = EXCLUDED.revpar,
      updated_at = NOW();

    -- Add day counter to result
    v_result := v_result || jsonb_build_object(
      'date', v_current_date::TEXT,
      'rooms_created', (
        SELECT COUNT(*) FROM public.forecast_room_daily WHERE forecast_date = v_current_date::DATE
      ),
      'summaries_created', 1
    );
  END LOOP;

  -- Build final result
  v_result := jsonb_build_object(
    'success', true,
    'start_date', p_start_date::TEXT,
    'end_date', p_end_date::TEXT,
    'total_days', v_total_days,
    'config_id', v_config.id,
    'generated_by', p_user_id,
    'results', v_result
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: CALCULATE DAILY SUMMARY
CREATE OR REPLACE FUNCTION public.rpc_calculate_daily_summary(
  p_forecast_date DATE,
  p_property_id UUID
)
RETURNS public.forecast_summary_daily AS $$
DECLARE
  v_result RECORD;
BEGIN
  INSERT INTO public.forecast_summary_daily (
    forecast_date,
    property_id,
    total_rooms,
    available_rooms,
    occupied_rooms,
    stayover_rooms,
    arrival_rooms,
    departure_rooms,
    oo_rooms,
    oi_rooms,
    hu_rooms,
    complimentary_rooms,
    occupancy_percentage,
    rooms_sold,
    total_revenue,
    room_revenue,
    extra_revenue,
    fit_revenue,
    grp_revenue,
    adr,
    revpar,
    created_at,
    updated_at
  )
  SELECT
    p_forecast_date,
    p_property_id,
    COUNT(*) AS total_rooms,
    COUNT(*) FILTER (WHERE room_status = 'available') AS available_rooms,
    COUNT(*) FILTER (WHERE room_status = 'occupied') AS occupied_rooms,
    COUNT(*) FILTER (WHERE booking_status = 'I') AS stayover_rooms,
    COUNT(*) FILTER (WHERE booking_status = 'B') AS arrival_rooms,
    COUNT(*) FILTER (WHERE booking_status = 'O') AS departure_rooms,
    COUNT(*) FILTER (WHERE room_status = 'oo') AS oo_rooms,
    COUNT(*) FILTER (WHERE room_status = 'oi') AS oi_rooms,
    COUNT(*) FILTER (WHERE room_status = 'hu') AS hu_rooms,
    0 AS complimentary_rooms,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE room_status = 'occupied')::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
      ELSE 0
    END AS occupancy_percentage,
    COUNT(*) FILTER (WHERE room_status = 'occupied') AS rooms_sold,
    COALESCE(SUM(total_revenue), 0) AS total_revenue,
    COALESCE(SUM(expected_room_revenue), 0) AS room_revenue,
    COALESCE(SUM(expected_extra_revenue), 0) AS extra_revenue,
    COALESCE(SUM(total_revenue) FILTER (WHERE guest_type = 'FIT'), 0) AS fit_revenue,
    COALESCE(SUM(total_revenue) FILTER (WHERE guest_type = 'GRP'), 0) AS grp_revenue,
    CASE
      WHEN COUNT(*) FILTER (WHERE room_status = 'occupied') > 0 THEN
        ROUND(SUM(total_revenue) / COUNT(*) FILTER (WHERE room_status = 'occupied'), 2)
      ELSE 0
    END AS adr,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(SUM(total_revenue) / COUNT(*), 2)
      ELSE 0
    END AS revpar,
    NOW(),
    NOW()
  FROM public.forecast_room_daily frd
  JOIN public.rooms r ON r.id = frd.room_id
  WHERE frd.forecast_date = p_forecast_date
    AND r.building_id IN (SELECT id FROM public.buildings WHERE property_id = p_property_id)
  ON CONFLICT (forecast_date, property_id) DO UPDATE SET
    total_rooms = EXCLUDED.total_rooms,
    available_rooms = EXCLUDED.available_rooms,
    occupied_rooms = EXCLUDED.occupied_rooms,
    stayover_rooms = EXCLUDED.stayover_rooms,
    arrival_rooms = EXCLUDED.arrival_rooms,
    departure_rooms = EXCLUDED.departure_rooms,
    oo_rooms = EXCLUDED.oo_rooms,
    oi_rooms = EXCLUDED.oi_rooms,
    hu_rooms = EXCLUDED.hu_rooms,
    occupancy_percentage = EXCLUDED.occupancy_percentage,
    rooms_sold = EXCLUDED.rooms_sold,
    total_revenue = EXCLUDED.total_revenue,
    room_revenue = EXCLUDED.room_revenue,
    extra_revenue = EXCLUDED.extra_revenue,
    fit_revenue = EXCLUDED.fit_revenue,
    grp_revenue = EXCLUDED.grp_revenue,
    adr = EXCLUDED.adr,
    revpar = EXCLUDED.revpar,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: ADJUST FORECAST ITEM
CREATE OR REPLACE FUNCTION public.rpc_adjust_forecast_item(
  p_item_id UUID,
  p_rate_amount NUMERIC,
  p_override_reason TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS public.forecast_room_daily AS $$
DECLARE
  v_item RECORD;
  v_old_rate NUMERIC;
  v_old_revenue NUMERIC;
  v_new_revenue NUMERIC;
BEGIN
  SELECT * INTO v_item
  FROM public.forecast_room_daily
  WHERE id = p_item_id;

  IF v_item IS NULL THEN
    RAISE EXCEPTION 'Forecast item not found';
  END IF;

  -- Record old values if not already overridden
  IF NOT v_item.is_override THEN
    v_old_rate := v_item.rate_amount;
    v_old_revenue := v_item.total_revenue;
  ELSE
    v_old_rate := v_item.original_rate_amount;
    v_old_revenue := v_item.original_revenue;
  END IF;

  v_new_revenue := p_rate_amount;

  -- Update forecast item with override
  UPDATE public.forecast_room_daily
  SET
    rate_amount = p_rate_amount,
    expected_room_revenue = p_rate_amount,
    expected_revenue = v_new_revenue,
    total_revenue = v_new_revenue,
    is_override = TRUE,
    original_rate_amount = v_old_rate,
    original_revenue = v_old_revenue,
    override_reason = p_override_reason,
    override_by = p_user_id,
    override_at = NOW(),
    updated_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: UPDATE ROOM STATUS DATE
CREATE OR REPLACE FUNCTION public.rpc_update_room_status_date(
  p_id UUID DEFAULT NULL,
  p_room_id UUID,
  p_status_type TEXT,
  p_from_date DATE,
  p_to_date DATE,
  p_reason TEXT,
  p_notes TEXT,
  p_created_by UUID DEFAULT NULL,
  p_action TEXT DEFAULT 'upsert'
)
RETURNS public.room_status_dates AS $$
DECLARE
  v_result RECORD;
  v_overlap_exists BOOLEAN := FALSE;
BEGIN
  IF p_room_id IS NULL THEN
    RAISE EXCEPTION 'Room ID is required';
  END IF;

  IF p_status_type NOT IN ('OO', 'OI', 'HU') THEN
    RAISE EXCEPTION 'Status type must be OO, OI, or HU';
  END IF;

  IF p_to_date < p_from_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.room_status_dates
    WHERE room_id = p_room_id
      AND status_type = p_status_type
      AND from_date <= p_to_date
      AND to_date >= p_from_date
      AND (p_id IS NULL OR id != p_id)
  ) INTO v_overlap_exists;

  IF v_overlap_exists AND p_action != 'end' THEN
    RAISE EXCEPTION 'Room status dates overlap with existing status';
  END IF;

  CASE p_action
    WHEN 'upsert' THEN
      INSERT INTO public.room_status_dates (
        id,
        room_id,
        status_type,
        from_date,
        to_date,
        reason,
        notes,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        p_id,
        p_room_id,
        p_status_type,
        p_from_date,
        p_to_date,
        COALESCE(p_reason, ''),
        p_notes,
        p_created_by,
        COALESCE(p_created_by, (SELECT updated_by FROM public.room_status_dates WHERE id = p_id LIMIT 1)),
        COALESCE(NOW(), (SELECT created_at FROM public.room_status_dates WHERE id = p_id LIMIT 1)),
        NOW()
      )
      ON CONFLICT (room_id, status_type, from_date, to_date)
      DO UPDATE SET
        reason = EXCLUDED.reason,
        notes = EXCLUDED.notes,
        updated_by = p_created_by,
        updated_at = NOW()
      RETURNING * INTO v_result;

    WHEN 'delete' THEN
      IF p_id IS NULL THEN
        RAISE EXCEPTION 'ID is required for delete action';
      END IF;

      DELETE FROM public.room_status_dates
      WHERE id = p_id
      RETURNING * INTO v_result;

    WHEN 'end' THEN
      IF p_id IS NULL THEN
        RAISE EXCEPTION 'ID is required for end action';
      END IF;

      UPDATE public.room_status_dates
      SET to_date = p_from_date - INTERVAL '1 day',
          updated_by = p_created_by,
          updated_at = NOW()
      WHERE id = p_id
      RETURNING * INTO v_result;

    ELSE
      RAISE EXCEPTION 'Invalid action: %', p_action;
  END CASE;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: GET FORECAST ROOM GRID
CREATE OR REPLACE FUNCTION public.rpc_get_forecast_room_grid(
  p_start_date DATE,
  p_end_date DATE,
  p_property_id UUID DEFAULT NULL,
  p_building_id UUID DEFAULT NULL,
  p_room_type_id UUID DEFAULT NULL,
  p_show_revenue BOOLEAN DEFAULT TRUE,
  p_show_pax BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  forecast_date DATE,
  room_id UUID,
  room_number TEXT,
  room_label TEXT,
  building_name TEXT,
  room_type_name TEXT,
  room_status TEXT,
  booking_status TEXT,
  guest_type TEXT,
  pax_adults INT,
  pax_children INT,
  rate_code TEXT,
  rate_amount NUMERIC,
  expected_revenue NUMERIC,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    frd.forecast_date,
    frd.room_id,
    r.room_number,
    r.room_number || ' (' || rt.name || ')' AS room_label,
    b.name AS building_name,
    rt.name AS room_type_name,
    frd.room_status,
    frd.booking_status,
    frd.guest_type,
    CASE WHEN p_show_pax THEN frd.pax_adults ELSE NULL END AS pax_adults,
    CASE WHEN p_show_pax THEN frd.pax_children ELSE NULL END AS pax_children,
    frd.rate_code,
    CASE WHEN p_show_revenue THEN frd.rate_amount ELSE NULL END AS rate_amount,
    CASE WHEN p_show_revenue THEN frd.expected_revenue ELSE NULL END AS expected_revenue,
    CASE WHEN p_show_revenue THEN frd.total_revenue ELSE NULL END AS total_revenue
  FROM public.forecast_room_daily frd
  JOIN public.rooms r ON r.id = frd.room_id
  JOIN public.room_types rt ON rt.id = r.room_type_id
  LEFT JOIN public.buildings b ON r.building_id = b.id
  WHERE frd.forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR b.property_id = p_property_id)
    AND (p_building_id IS NULL OR frd.building_id = p_building_id)
    AND (p_room_type_id IS NULL OR frd.room_type_id = p_room_type_id)
  ORDER BY frd.forecast_date, r.room_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: GET FORECAST SUMMARY
CREATE OR REPLACE FUNCTION public.rpc_get_forecast_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_property_id UUID DEFAULT NULL
)
RETURNS SETOF public.forecast_summary_daily AS $$
BEGIN
  RETURN QUERY
  SELECT fs.*
  FROM public.forecast_summary_daily fs
  WHERE fs.forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR fs.property_id = p_property_id)
  ORDER BY fs.forecast_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: DELETE FORECAST DATA
CREATE OR REPLACE FUNCTION public.rpc_delete_forecast_data(
  p_start_date DATE,
  p_end_date DATE,
  p_property_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_deleted_items INT;
  v_deleted_summaries INT;
BEGIN
  -- Delete forecast room daily data
  DELETE FROM public.forecast_room_daily
  WHERE forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR building_id IN (SELECT id FROM public.buildings WHERE property_id = p_property_id));

  GET DIAGNOSTICS v_deleted_items INTO ROW_COUNT;

  -- Delete forecast summaries
  DELETE FROM public.forecast_summary_daily
  WHERE forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR property_id = p_property_id);

  GET DIAGNOSTICS v_deleted_summaries INTO ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_items', v_deleted_items,
    'deleted_summaries', v_deleted_summaries,
    'deleted_by', p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PART 4: RLS POLICIES
-- =============================================

ALTER TABLE public.forecast_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read forecast config" ON public.forecast_configurations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify forecast config" ON public.forecast_configurations FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

ALTER TABLE public.room_status_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read room status" ON public.room_status_dates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify room status" ON public.room_status_dates FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

ALTER TABLE public.corporate_allotments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read allotments" ON public.corporate_allotments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify allotments" ON public.corporate_allotments FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

ALTER TABLE public.forecast_room_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read forecast" ON public.forecast_room_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify forecast" ON public.forecast_room_daily FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

ALTER TABLE public.forecast_summary_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read summary" ON public.forecast_summary_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager+ modify summary" ON public.forecast_summary_daily FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','manager')));

-- =============================================
-- DONE - Complete Forecast Deployment (FIXED)
-- =============================================
