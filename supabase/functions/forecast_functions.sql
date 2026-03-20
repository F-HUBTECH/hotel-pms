-- =============================================
-- Hotel PMS - Forecast RPC Functions
-- KFO Parity - Room-by-Room Forecast Grid
-- =============================================

-- =============================================
-- 1. GENERATE DAILY FORECAST
-- Core forecasting engine - generates room-by-room forecasts
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_generate_daily_forecast(
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  p_config_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS SETOF JSONB AS $$
DECLARE
  v_config RECORD;
  v_current_date DATE;
  v_property_id UUID;
  v_forecast_date DATE;
  v_room RECORD;
  v_reservation RECORD;
  v_stayover BOOLEAN;
  v_arrival BOOLEAN;
  v_departure BOOLEAN;
  v_expected_revenue NUMERIC(12,2);
  v_expected_room_revenue NUMERIC(12,2);
  v_expected_extra_revenue NUMERIC(12,2);
  v_premium NUMERIC(5,2);
  v_is_weekend BOOLEAN;
  v_dow INT;
  v_available BOOLEAN;
  v_room_status TEXT;
  v_booking_status TEXT;
  v_guest_type TEXT;
  v_pax_adults INT;
  v_pax_children INT;
  v_rate_code TEXT;
  v_rate_amount NUMERIC(10,2);
  v_allot_code TEXT;
  v_allot_rate NUMERIC(10,2);
  v_is_override BOOLEAN;

  -- Room status tracking
  v_has_oo BOOLEAN;
  v_has_oi BOOLEAN;
  v_has_hu BOOLEAN;
BEGIN
  -- Get configuration
  IF p_config_id IS NOT NULL THEN
    SELECT * INTO v_config FROM public.forecast_configurations
    WHERE id = p_config_id AND is_active = true;
  ELSE
    SELECT * INTO v_config FROM public.forecast_configurations
    WHERE is_active = true LIMIT 1;
  END IF;

  v_property_id := v_config.property_id;

  -- Generate forecasts for each date in range
  FOR v_forecast_date IN SELECT generate_series(p_start_date, p_end_date, '1 day'::INTERVAL) LOOP
    v_dow := EXTRACT(DOW FROM v_forecast_date);
    v_is_weekend := v_dow IN (0, 6); -- Sunday or Saturday
    v_premium := public.get_date_premium(
      v_forecast_date,
      v_config.include_weekend_premium,
      v_config.include_holiday_premium,
      v_config.weekend_premium_rate,
      v_config.holiday_premium_rate
    );

    -- Get all rooms for property
    FOR v_room IN
      SELECT r.id, r.room_number, r.room_type_id, r.building_id, rt.name AS room_type_name
      FROM public.rooms r
      JOIN public.room_types rt ON rt.id = r.room_type_id
      LEFT JOIN public.buildings b ON b.id = r.building_id
      WHERE r.deleted_at IS NULL
    LOOP
      -- Check room status for this date
      v_has_oo := EXISTS(
        SELECT 1 FROM public.room_status_dates rsd
        WHERE rsd.room_id = v_room.id
          AND rsd.status_type = 'OO'
          AND rsd.from_date <= v_forecast_date
          AND rsd.to_date >= v_forecast_date
      );

      v_has_oi := EXISTS(
        SELECT 1 FROM public.room_status_dates rsd
        WHERE rsd.room_id = v_room.id
          AND rsd.status_type = 'OI'
          AND rsd.from_date <= v_forecast_date
          AND rsd.to_date >= v_forecast_date
      );

      v_has_hu := EXISTS(
        SELECT 1 FROM public.room_status_dates rsd
        WHERE rsd.room_id = v_room.id
          AND rsd.status_type = 'HU'
          AND rsd.from_date <= v_forecast_date
          AND rsd.to_date >= v_forecast_date
      );

      -- Check if room is occupied
      IF public.is_room_occupied_on_date(v_room.id, v_forecast_date) THEN
        v_room_status := 'occupied';
        v_booking_status := NULL;
        v_guest_type := NULL;
      ELSE
        v_room_status := 'available';
        v_booking_status := NULL;
        v_guest_type := NULL;
      END IF;

      -- Determine availability for forecast
      IF v_has_oo OR v_has_oi THEN
        v_available := FALSE;
      ELSIF NOT v_config.include_hu_rooms AND v_has_hu THEN
        v_available := FALSE;
      ELSE
        v_available := TRUE;
      END IF;

      -- Find reservation for this room and date
      SELECT * INTO v_reservation
      FROM public.reservations rsv
      JOIN public.rooms rm ON rm.id = rsv.room_id
      WHERE rm.id = v_room.id
        AND v_forecast_date >= rsv.check_in_date
        AND v_forecast_date < rsv.check_out_date
        AND rsv.status IN ('B', 'I')
        AND rsv.deleted_at IS NULL
      ORDER BY rsv.check_in_date DESC
      LIMIT 1;

      -- Calculate booking values
      IF v_reservation IS NOT NULL THEN
        v_booking_status := CASE
          WHEN v_reservation.status = 'B' THEN 'booked'
          WHEN v_reservation.status = 'I' THEN 'in_house'
          ELSE 'other'
        END;

        v_guest_type := CASE
          WHEN v_reservation.guest_type_id IN (
            (SELECT id FROM public.guest_types WHERE name IN ('FIT', 'Free Individual'))
          ) THEN 'FIT'
          ELSE 'GRP'
        END;

        v_pax_adults := COALESCE(v_reservation.adults, 0);
        v_pax_children := COALESCE(v_reservation.children, 0);
        v_rate_code := v_reservation.rate_code;
        v_rate_amount := COALESCE(v_reservation.rate, 0);
      ELSE
        v_booking_status := NULL;
        v_guest_type := NULL;
        v_pax_adults := 0;
        v_pax_children := 0;
        v_rate_code := NULL;
        v_rate_amount := NULL;
      END IF;

      -- Calculate expected revenue
      IF NOT v_available THEN
        v_expected_revenue := 0;
        v_expected_room_revenue := 0;
        v_expected_extra_revenue := 0;
      ELSIF v_reservation IS NOT NULL AND v_rate_amount > 0 THEN
        -- Room revenue
        v_expected_room_revenue := v_rate_amount;

        -- Extra revenue estimate (10% of room revenue)
        v_expected_extra_revenue := v_rate_amount * 0.10;

        -- Total revenue
        v_expected_revenue := v_expected_room_revenue + v_expected_extra_revenue;

        -- Apply premium
        IF v_premium > 0 THEN
          v_expected_revenue := v_expected_revenue * (1 + v_premium);
          v_expected_room_revenue := v_expected_room_revenue * (1 + v_premium);
        END IF;
      ELSE
        -- Forecast for available room - use historical average
        SELECT COALESCE(
          AVG(
            CASE
              WHEN frd.rate_amount > 0 THEN frd.rate_amount
              ELSE 0
            END
          ),
          0
        ) INTO v_expected_room_revenue
        FROM public.forecast_room_daily frd
        WHERE frd.room_id = v_room.id
          AND EXTRACT(DOW FROM frd.forecast_date) = EXTRACT(DOW FROM v_forecast_date)
          AND frd.is_override = FALSE;

        IF v_expected_room_revenue IS NULL OR v_expected_room_revenue = 0 THEN
          -- Fallback to room type base rate
          SELECT rt.base_price INTO v_expected_room_revenue
          FROM public.room_types rt
          WHERE rt.id = v_room.room_id;

          v_expected_extra_revenue := v_expected_room_revenue * 0.10;
          v_expected_revenue := v_expected_room_revenue + v_expected_extra_revenue;

          -- Apply premium
          IF v_premium > 0 THEN
            v_expected_revenue := v_expected_revenue * (1 + v_premium);
          END IF;
        END IF;

        v_expected_extra_revenue := v_expected_room_revenue * 0.10;
        v_expected_revenue := v_expected_room_revenue + v_expected_extra_revenue;

        -- Apply premium
        IF v_premium > 0 THEN
          v_expected_revenue := v_expected_revenue * (1 + v_premium);
          v_expected_room_revenue := v_expected_room_revenue * (1 + v_premium);
        END IF;
      END IF;

      v_is_override := FALSE;

      -- Return forecast row as JSON
      RETURN NEXT jsonb_build_object(
        'forecast_date', v_forecast_date,
        'room_id', v_room.id,
        'room_number', v_room.room_number,
        'room_type_id', v_room.room_type_id,
        'room_type_name', v_room.room_type_name,
        'building_id', v_room.building_id,
        'room_status', v_room_status,
        'booking_status', v_booking_status,
        'guest_type', v_guest_type,
        'pax_adults', v_pax_adults,
        'pax_children', v_pax_children,
        'rate_code', v_rate_code,
        'rate_amount', v_rate_amount,
        'allot_code', v_allot_code,
        'allot_rate_amount', v_allot_rate,
        'is_available', v_available,
        'expected_revenue', v_expected_revenue,
        'expected_room_revenue', v_expected_room_revenue,
        'expected_extra_revenue', v_expected_extra_revenue,
        'is_override', v_is_override,
        'original_rate_amount', v_rate_amount,
        'original_revenue', v_expected_revenue
      );
    END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. CALCULATE DAILY SUMMARY
-- Aggregates daily forecast data and compares with actuals
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_calculate_daily_summary(
  p_forecast_date DATE,
  p_property_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_summary JSONB;
  v_total_rooms INT;
  v_available_rooms INT;
  v_occupied_rooms INT;
  v_stayover_rooms INT;
  v_arrival_rooms INT;
  v_departure_rooms INT;
  v_oo_rooms INT;
  v_oi_rooms INT;
  v_hu_rooms INT;
  v_complimentary_rooms INT;

  v_total_revenue NUMERIC(12,2);
  v_room_revenue NUMERIC(12,2);
  v_extra_revenue NUMERIC(12,2);
  v_fit_revenue NUMERIC(12,2);
  v_grp_revenue NUMERIC(12,2);
  v_actual_revenue NUMERIC(12,2);

  v_actual_rooms_sold INT;
  v_actual_adr NUMERIC(10,2);
  v_actual_revpar NUMERIC(10,2);

  v_occupancy_percentage NUMERIC(5,2);
  v_rooms_sold_percentage NUMERIC(5,2);
  v_adr NUMERIC(10,2);
  v_revpar NUMERIC(10,2);

  v_variance NUMERIC(12,2);
  v_variance_percentage NUMERIC(5,2);
BEGIN
  -- Get total rooms for property
  SELECT COUNT(*) INTO v_total_rooms
  FROM public.rooms r
  LEFT JOIN public.buildings b ON b.id = r.building_id
  WHERE r.deleted_at IS NULL;

  -- Calculate availability (exclude OO and OI, include HU based on config)
  SELECT COALESCE(SUM(CASE
    WHEN NOT (EXISTS(
      SELECT 1 FROM room_status_dates rsd
      WHERE rsd.room_id = r.id AND rsd.status_type = 'OO'
        AND rsd.from_date <= p_forecast_date
        AND rsd.to_date >= p_forecast_date
    )) THEN 1 ELSE 0 END +
    NOT (EXISTS(
      SELECT 1 FROM room_status_dates rsd
      WHERE rsd.room_id = r.id AND rsd.status_type = 'OI'
        AND rsd.from_date <= p_forecast_date
        AND rsd.to_date >= p_forecast_date
    )) THEN 1 ELSE 0 END
    + (EXISTS(
      SELECT 1 FROM room_status_dates rsd
      WHERE rsd.room_id = r.id AND rsd.status_type = 'HU'
        AND rsd.from_date <= p_forecast_date
        AND rsd.to_date >= p_forecast_date
    )) THEN 1 ELSE 0 END
  END), 0) INTO v_available_rooms
  FROM public.rooms r
  LEFT JOIN public.buildings b ON b.id = r.building_id
  WHERE r.deleted_at IS NULL;

  v_occupied_rooms := v_total_rooms - v_available_rooms;

  -- Get occupied counts by status type
  SELECT
    COALESCE(SUM(CASE WHEN frd.room_status = 'occupied' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN frd.room_status = 'oo' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN frd.room_status = 'oi' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN frd.room_status = 'hu' THEN 1 ELSE 0 END), 0)
  INTO v_occupied_rooms, v_oo_rooms, v_oi_rooms, v_hu_rooms
  FROM public.forecast_room_daily frd
  WHERE frd.forecast_date = p_forecast_date;

  -- Get arrivals and departures from reservations
  SELECT COUNT(*) INTO v_arrival_rooms
  FROM public.reservations r
  WHERE DATE(r.check_in_date) = p_forecast_date
    AND r.status IN ('B', 'I')
    AND r.deleted_at IS NULL;

  SELECT COUNT(*) INTO v_departure_rooms
  FROM public.reservations r
  WHERE DATE(r.check_out_date) = p_forecast_date
    AND r.status = 'I'
    AND r.deleted_at IS NULL;

  -- Calculate stayovers
  v_stayover_rooms := v_occupied_rooms - v_arrival_rooms;

  -- Calculate complimentary
  v_complimentary_rooms := COALESCE(SUM(CASE
    WHEN frd.room_status = 'hu' THEN 1 ELSE 0 END
  ), 0)
  FROM public.forecast_room_daily frd
  WHERE frd.forecast_date = p_forecast_date;

  -- Calculate revenue
  SELECT
    COALESCE(SUM(fr.expected_revenue), 0),
    COALESCE(SUM(fr.expected_room_revenue), 0),
    COALESCE(SUM(fr.expected_extra_revenue), 0)
  INTO v_total_revenue, v_room_revenue, v_extra_revenue
  FROM public.forecast_room_daily frd
  WHERE frd.forecast_date = p_forecast_date
    AND frd.room_status = 'occupied';

  -- Segment breakdown
  SELECT
    COALESCE(SUM(CASE WHEN frd.guest_type = 'FIT' THEN frd.expected_revenue ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN frd.guest_type = 'GRP' THEN frd.expected_revenue ELSE 0 END), 0)
  INTO v_fit_revenue, v_grp_revenue
  FROM public.forecast_room_daily frd
  WHERE frd.forecast_date = p_forecast_date
    AND frd.is_override = FALSE;

  -- Get actuals if they exist
  SELECT
    COALESCE(SUM(fs.actual_rooms_sold), 0),
    COALESCE(SUM(fs.actual_revenue), 0),
    COALESCE(SUM(fs.actual_adr), 0),
    COALESCE(SUM(fs.actual_revpar), 0)
  INTO v_actual_rooms_sold, v_actual_revenue, v_actual_adr, v_actual_revpar
  FROM public.forecast_summary_daily fs
  WHERE fs.forecast_date = p_forecast_date;

  -- Calculate occupancy percentage
  IF v_available_rooms > 0 THEN
    v_occupancy_percentage := ROUND((v_occupied_rooms::NUMERIC / (v_available_rooms::NUMERIC)) * 100, 2);
  ELSE
    v_occupancy_percentage := 0;
  END IF;

  -- Calculate rooms sold percentage
  IF v_available_rooms > 0 THEN
    v_rooms_sold_percentage := ROUND((v_actual_rooms_sold::NUMERIC / (v_available_rooms::NUMERIC)) * 100, 2);
  ELSE
    v_rooms_sold_percentage := 0;
  END IF;

  -- Calculate ADR
  IF v_occupied_rooms > 0 THEN
    v_adr := ROUND(v_total_revenue / v_occupied_rooms::NUMERIC, 2);
  ELSE
    v_adr := 0;
  END IF;

  -- Calculate RevPAR
  IF v_available_rooms > 0 THEN
    v_revpar := ROUND(v_total_revenue / v_available_rooms::NUMERIC, 2);
  ELSE
    v_revpar := 0;
  END IF;

  -- Calculate variance
  v_variance := COALESCE(v_actual_revenue, 0) - v_total_revenue;
  IF v_total_revenue > 0 THEN
    v_variance_percentage := ROUND(ABS(v_variance / v_total_revenue) * 100, 2);
  ELSE
    v_variance_percentage := 0;
  END IF;

  -- Build summary JSON
  v_summary := jsonb_build_object(
    'forecast_date', p_forecast_date,
    'property_id', v_property_id,
    'total_rooms', v_total_rooms,
    'available_rooms', v_available_rooms,
    'occupied_rooms', v_occupied_rooms,
    'stayover_rooms', v_stayover_rooms,
    'arrival_rooms', v_arrival_rooms,
    'departure_rooms', v_departure_rooms,

    -- Room status
    'oo_rooms', v_oo_rooms,
    'oi_rooms', v_oi_rooms,
    'hu_rooms', v_hu_rooms,
    'complimentary_rooms', v_complimentary_rooms,

    -- Occupancy metrics
    'occupancy_percentage', v_occupancy_percentage,
    'rooms_sold', v_rooms_sold_percentage,

    -- Revenue
    'total_revenue', v_total_revenue,
    'room_revenue', v_room_revenue,
    'extra_revenue', v_extra_revenue,
    'fit_revenue', v_fit_revenue,
    'grp_revenue', v_grp_revenue,

    -- KPIs
    'adr', v_adr,
    'revpar', v_revpar,

    -- Actuals
    'actual_rooms_sold', v_actual_rooms_sold,
    'actual_revenue', v_actual_revenue,
    'actual_adr', v_actual_adr,
    'actual_revpar', v_actual_revpar,

    -- Variance
    'revenue_variance', v_variance,
    'variance_percentage', v_variance_percentage,

    -- Accuracy
    'accuracy_percentage',
    CASE
      WHEN v_total_revenue > 0 AND v_actual_revenue > 0 THEN
        ROUND(100 - (ABS(v_variance) / v_total_revenue * 100), 2)
      ELSE NULL
    END
  );

  RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. ADJUST FORECAST ITEM
-- Manually override forecast rates and revenue
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_adjust_forecast_item(
  p_item_id UUID,
  p_rate_amount NUMERIC,
  p_override_reason TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_existing_record RECORD;
  v_item_id UUID;
  v_is_updated BOOLEAN := FALSE;
  v_forecast_date DATE;
  v_summary_updated BOOLEAN := FALSE;
BEGIN
  -- Find existing forecast item
  SELECT id INTO v_item_id
  FROM public.forecast_room_daily
  WHERE id = p_item_id;

  IF v_item_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Forecast item not found'
    );
  END IF;

  -- Get existing record
  SELECT * INTO v_existing_record
  FROM public.forecast_room_daily
  WHERE id = v_item_id;

  IF v_existing_record.is_override = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This item has already been overridden'
    );
  END IF;

  -- Store original values
  UPDATE public.forecast_room_daily SET
    original_rate_amount = COALESCE(v_existing_record.rate_amount, v_existing_record.rate_amount),
    original_revenue = COALESCE(v_existing_record.expected_revenue, v_existing_record.expected_revenue),
    is_override = TRUE,
    override_reason = p_override_reason,
    override_by = p_user_id,
    override_at = NOW()
  WHERE id = v_item_id;

  -- Recalculate revenue
  v_is_updated := FOUND;

  -- Update summary if revenue changed
  IF v_is_updated THEN
    v_forecast_date := v_existing_record.forecast_date;

    -- Trigger will recalculate summary
    -- Just mark that summary needs update
    v_summary_updated := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'item_id', v_item_id,
    'is_updated', v_is_updated,
    'summary_updated', v_summary_updated
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. UPDATE ROOM STATUS DATE
-- Add or update room status (OO/OI/HU)
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_update_room_status_date(
  p_room_id UUID,
  p_status_type TEXT CHECK (status_type IN ('OO', 'OI', 'HU')),
  p_from_date DATE,
  p_to_date DATE,
  p_reason TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_existing_record RECORD;
BEGIN
  -- Check for overlapping date ranges
  IF EXISTS (
    SELECT 1 FROM public.room_status_dates rsd
    WHERE rsd.room_id = p_room_id
      AND rsd.status_type = p_status_type
      AND rsd.to_date >= p_from_date
      AND rsd.from_date <= p_to_date
      AND (rsd.id IS NULL OR rsd.id != (
        SELECT MAX(id) FROM public.room_status_dates
        WHERE rsd.room_id = p_room_id AND rsd.status_type = p_status_type
      ))
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Overlapping room status dates exist for this room'
    );
  END IF;

  -- Upsert room status date
  INSERT INTO public.room_status_dates (
    room_id, status_type, from_date, to_date, reason, created_by
  ) VALUES (
    p_room_id, p_status_type, p_from_date, p_to_date, p_reason, p_user_id
  )
  ON CONFLICT (room_id, status_type, from_date, to_date) DO UPDATE SET
    to_date = p_to_date,
    reason = p_reason,
    updated_by = p_user_id,
    updated_at = NOW()
  ;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'status_type', p_status_type,
    'from_date', p_from_date,
    'to_date', p_to_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. GET FORECAST ROOM GRID
-- Retrieve room-by-room forecast grid
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_get_forecast_room_grid(
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  p_config_id UUID DEFAULT NULL,
  p_building_id UUID DEFAULT NULL,
  p_room_type_id UUID DEFAULT NULL,
  p_include_oo_rooms BOOLEAN DEFAULT FALSE,
  p_include_oi_rooms BOOLEAN DEFAULT FALSE,
  p_include_hu_rooms BOOLEAN DEFAULT TRUE
)
RETURNS SETOF JSONB AS $$
DECLARE
  v_row JSONB;
BEGIN
  FOR v_row IN
    SELECT
      jsonb_build_object(
        'forecast_date', frd.forecast_date,
        'room_id', frd.room_id,
        'room_number', r.room_number,
        'room_type_id', frd.room_type_id,
        'room_type_name', rt.name,
        'building_id', frd.building_id,
        'building_name', b.name,

        -- Status
        'room_status', frd.room_status,
        'booking_status', frd.booking_status,
        'is_available', frd.is_available,

        -- Guest/Segment
        'guest_type', frd.guest_type,
        'pax_adults', frd.pax_adults,
        'pax_children', frd.pax_children,

        -- Rates
        'rate_code', frd.rate_code,
        'rate_amount', frd.rate_amount,
        'allot_code', frd.allot_code,
        'allot_rate_amount', frd.allot_rate_amount,
        'is_override', frd.is_override,

        -- Revenue
        'expected_revenue', frd.expected_revenue,
        'expected_room_revenue', frd.expected_room_revenue,
        'expected_extra_revenue', frd.expected_extra_revenue,

        -- Override info
        'original_rate_amount', frd.original_rate_amount,
        'original_revenue', frd.original_revenue,
        'override_reason', frd.override_reason,
        'override_by', frd.override_by
      )
    ORDER BY frd.forecast_date, r.room_number
    FROM public.forecast_room_daily frd
    LEFT JOIN public.rooms r ON r.id = frd.room_id
    LEFT JOIN public.room_types rt ON rt.id = frd.room_type_id
    LEFT JOIN public.buildings b ON b.id = frd.building_id
    WHERE frd.forecast_date BETWEEN p_start_date AND p_end_date
      AND (p_building_id IS NULL OR frd.building_id = p_building_id)
      AND (p_room_type_id IS NULL OR frd.room_type_id = p_room_type_id)
      AND (
        (p_include_oo_rooms OR frd.room_status != 'oo') AND
        (p_include_oi_rooms OR frd.room_status != 'oi') AND
        (p_include_hu_rooms OR frd.room_status != 'hu')
      )
    ORDER BY frd.forecast_date, r.room_number
  LOOP
    RETURN NEXT v_row;
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. DELETE FORECAST DATA
-- Clear forecast data for date range
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_delete_forecast_data(
  p_start_date DATE,
  p_end_date,
  p_property_id UUID DEFAULT NULL,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_deleted_items INT;
  v_deleted_summaries INT;
BEGIN
  -- Delete forecast room daily data
  DELETE FROM public.forecast_room_daily
  WHERE forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR property_id = p_property_id);

  GET DIAGNOSTICS v_deleted_items INTO v_deleted_items;

  -- Delete forecast summaries
  DELETE FROM public.forecast_summary_daily
  WHERE forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR property_id = p_property_id);

  GET DIAGNOSTICS v_deleted_summaries INTO v_deleted_summaries;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_items', v_deleted_items,
    'deleted_summaries', v_deleted_summaries
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- DONE: Forecast RPC Functions
-- =============================================
