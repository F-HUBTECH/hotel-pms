-- =============================================
-- Hotel PMS - Phase 2: Forecast RPC Functions
-- Schema V11 - Forecast Enhancement
-- =============================================

-- =============================================
-- 1. RPC: GENERATE DAILY FORECAST
-- =============================================
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
  v_rooms_created INT := 0;
  v_summary_created INT := 0;
  v_result JSONB;
BEGIN
  -- Get forecast configuration
  IF p_config_id IS NOT NULL THEN
    SELECT * INTO v_config FROM forecast_configurations WHERE id = p_config_id;
  ELSE
    -- Get default configuration
    SELECT * INTO v_config FROM forecast_configurations
      WHERE is_active = TRUE AND (p_property_id IS NULL OR property_id = p_property_id)
      LIMIT 1;
  END IF;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'No forecast configuration found';
  END IF;

  -- Calculate total days
  v_total_days := p_end_date - p_start_date + 1;

  -- Loop through each date
  FOR v_current_date IN SELECT generate_series(p_start_date, p_end_date, INTERVAL '1 day')::DATE
  LOOP
    -- Generate room-by-room forecast for this date
    INSERT INTO forecast_room_daily (
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
            WHEN res.check_in_date = v_current_date THEN 'B'  -- Arrival
            ELSE 'I'  -- Stayover
          END
        WHEN res.check_out_date = v_current_date THEN 'O'  -- Departure
        ELSE NULL
      END AS booking_status,
      CASE
        WHEN res.group_id IS NOT NULL THEN 'GRP'
        WHEN res.id IS NOT NULL THEN 'FIT'
        ELSE NULL
      END AS guest_type,
      COALESCE(res.adult_count, 0),
      COALESCE(res.child_count, 0),
      tc.code AS rate_code,
      CASE
        WHEN v_config.include_weekend_premium THEN
          r.base_rate * (1 + get_date_premium(v_current_date, TRUE, v_config.include_holiday_premium,
                                             v_config.weekend_premium_rate, v_config.holiday_premium_rate))
        ELSE r.base_rate
      END AS rate_amount,
      ca.allot_code,
      CASE
        WHEN res.id IS NOT NULL THEN
          CASE
            WHEN v_config.include_weekend_premium THEN
              r.base_rate * (1 + get_date_premium(v_current_date, TRUE, v_config.include_holiday_premium,
                                                 v_config.weekend_premium_rate, v_config.holiday_premium_rate))
            ELSE r.base_rate
          END
        ELSE 0
      END AS expected_room_revenue,
      0 AS expected_extra_revenue,
      CASE
        WHEN res.id IS NOT NULL THEN
          CASE
            WHEN v_config.include_weekend_premium THEN
              r.base_rate * (1 + get_date_premium(v_current_date, TRUE, v_config.include_holiday_premium,
                                                 v_config.weekend_premium_rate, v_config.holiday_premium_rate))
            ELSE r.base_rate
          END
        ELSE 0
      END AS total_revenue,
      CASE
        -- Check room status
        WHEN (SELECT 1 FROM room_status_dates rsd
              WHERE rsd.room_id = r.id
                AND rsd.status_type = 'OO'
                AND rsd.from_date <= v_current_date AND rsd.to_date >= v_current_date) = 1
          AND NOT v_config.include_oo_rooms THEN 'oo'
        WHEN (SELECT 1 FROM room_status_dates rsd
              WHERE rsd.room_id = r.id
                AND rsd.status_type = 'OI'
                AND rsd.from_date <= v_current_date AND rsd.to_date >= v_current_date) = 1
          AND NOT v_config.include_oi_rooms THEN 'oi'
        WHEN (SELECT 1 FROM room_status_dates rsd
              WHERE rsd.room_id = r.id
                AND rsd.status_type = 'HU'
                AND rsd.from_date <= v_current_date AND rsd.to_date >= v_current_date) = 1
          AND NOT v_config.include_hu_rooms THEN 'hu'
        WHEN res.id IS NOT NULL THEN 'occupied'
        ELSE 'available'
      END AS room_status,
      CASE
        WHEN res.id IS NOT NULL THEN 'confirmed'
        ELSE 'projected'
      END AS forecast_type,
      NOW(),
      NOW()
    FROM rooms r
    LEFT JOIN reservations res ON r.id = res.room_id
      AND res.status IN ('confirmed', 'checked_in')
      AND res.check_in_date <= v_current_date
      AND res.check_out_date > v_current_date
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN revenue_transaction_codes tc ON rt.default_rate_code = tc.code
    LEFT JOIN corporate_allotments ca ON res.allotment_code = ca.allot_code
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
    INSERT INTO forecast_summary_daily (
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
      COALESCE(p_property_id, (SELECT id FROM properties LIMIT 1)),
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
    FROM forecast_room_daily
    WHERE forecast_date = v_current_date::DATE
      AND (p_property_id IS NULL OR building_id IN (SELECT id FROM buildings WHERE property_id = p_property_id))
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

    v_rooms_created := v_rooms_created + (SELECT COUNT(*) FROM rooms);
    v_summary_created := v_summary_created + 1;
  END LOOP;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'total_days', v_total_days,
    'config_id', v_config.id,
    'rooms_processed', v_rooms_created,
    'summaries_created', v_summary_created,
    'generated_by', p_user_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.rpc_generate_daily_forecast IS 'Generates daily forecast for date range with seasonality and room status constraints';


-- =============================================
-- 2. RPC: CALCULATE DAILY SUMMARY
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_calculate_daily_summary(
  p_forecast_date DATE,
  p_property_id UUID
)
RETURNS forecast_summary_daily AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Calculate summary from room_daily data
  INSERT INTO forecast_summary_daily (
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
  FROM forecast_room_daily frd
  JOIN rooms r ON r.id = frd.room_id
  WHERE frd.forecast_date = p_forecast_date
    AND r.building_id IN (SELECT id FROM buildings WHERE property_id = p_property_id)
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

COMMENT ON FUNCTION public.rpc_calculate_daily_summary IS 'Calculates daily forecast summary with KPIs from room_daily data';


-- =============================================
-- 3. RPC: ADJUST FORECAST ITEM
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_adjust_forecast_item(
  p_item_id UUID,
  p_new_rate NUMERIC,
  p_override_reason TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS forecast_room_daily AS $$
DECLARE
  v_item RECORD;
  v_old_rate NUMERIC;
  v_old_revenue NUMERIC;
  v_new_revenue NUMERIC;
  v_pax_multiplier NUMERIC;
BEGIN
  -- Get current forecast item
  SELECT * INTO v_item
  FROM forecast_room_daily
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

  -- Calculate new revenue (same ratio as before)
  IF v_old_rate > 0 THEN
    v_pax_multiplier := p_new_rate / v_old_rate;
  ELSE
    v_pax_multiplier := 1;
  END IF;

  v_new_revenue := p_new_rate * v_pax_multiplier;

  -- Update forecast item with override
  UPDATE forecast_room_daily
  SET
    rate_amount = p_new_rate,
    expected_room_revenue = p_new_rate,
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

  -- Recalculate daily summary if needed
  PERFORM rpc_calculate_daily_summary(v_item.forecast_date,
    (SELECT property_id FROM buildings WHERE id = v_item.building_id));

  RETURN v_item;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.rpc_adjust_forecast_item IS 'Manually adjusts forecast item with audit trail and recalculates summary';


-- =============================================
-- 4. RPC: UPDATE ROOM STATUS DATE
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_update_room_status_date(
  p_id UUID DEFAULT NULL,
  p_room_id UUID,
  p_status_type TEXT,
  p_from_date DATE,
  p_to_date DATE,
  p_reason TEXT,
  p_notes TEXT,
  p_created_by UUID DEFAULT NULL,
  p_action TEXT DEFAULT 'upsert'  -- 'upsert', 'delete', 'end'
)
RETURNS room_status_dates AS $$
DECLARE
  v_result RECORD;
  v_overlap_exists BOOLEAN := FALSE;
BEGIN
  -- Validate inputs
  IF p_room_id IS NULL THEN
    RAISE EXCEPTION 'Room ID is required';
  END IF;

  IF p_status_type NOT IN ('OO', 'OI', 'HU') THEN
    RAISE EXCEPTION 'Status type must be OO, OI, or HU';
  END IF;

  IF p_to_date < p_from_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  -- Check for overlaps (excluding current record for updates)
  SELECT EXISTS(
    SELECT 1 FROM room_status_dates
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
      -- Insert or update
      INSERT INTO room_status_dates (
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
        COALESCE(p_created_by, (SELECT updated_by FROM room_status_dates WHERE id = p_id LIMIT 1)),
        p_created_by,
        COALESCE(NOW(), (SELECT created_at FROM room_status_dates WHERE id = p_id LIMIT 1)),
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

      DELETE FROM room_status_dates
      WHERE id = p_id
      RETURNING * INTO v_result;

    WHEN 'end' THEN
      -- End existing status early
      IF p_id IS NULL THEN
        RAISE EXCEPTION 'ID is required for end action';
      END IF;

      UPDATE room_status_dates
      SET to_date = p_from_date - INTERVAL '1 day',
          updated_by = p_created_by,
          updated_at = NOW()
      WHERE id = p_id
      RETURNING * INTO v_result;

    ELSE
      RAISE EXCEPTION 'Invalid action: %', p_action;
  END CASE;

  -- Rebuild forecasts for affected dates
  IF v_result IS NOT NULL THEN
    -- Get property ID
    PERFORM rpc_generate_daily_forecast(
      LEAST(v_result.from_date, p_from_date),
      GREATEST(v_result.to_date, p_to_date),
      (SELECT property_id FROM rooms WHERE id = v_result.room_id),
      NULL,
      p_created_by
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.rpc_update_room_status_date IS 'Manages room status dates (OO/OI/HU) with overlap validation and forecast rebuild';


-- =============================================
-- 5. RPC: GET FORECAST ROOM GRID
-- =============================================
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
  FROM forecast_room_daily frd
  JOIN rooms r ON r.id = frd.room_id
  JOIN room_types rt ON r.room_type_id = rt.id
  LEFT JOIN buildings b ON r.building_id = b.id
  WHERE frd.forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR b.property_id = p_property_id)
    AND (p_building_id IS NULL OR frd.building_id = p_building_id)
    AND (p_room_type_id IS NULL OR frd.room_type_id = p_room_type_id)
  ORDER BY frd.forecast_date, r.room_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.rpc_get_forecast_room_grid IS 'Returns room-by-room forecast grid with optional revenue and pax display';


-- =============================================
-- 6. RPC: GET FORECAST SUMMARY
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_get_forecast_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_property_id UUID DEFAULT NULL
)
RETURNS SETOF forecast_summary_daily AS $$
BEGIN
  RETURN QUERY
  SELECT fs.*
  FROM forecast_summary_daily fs
  WHERE fs.forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR fs.property_id = p_property_id)
  ORDER BY fs.forecast_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.rpc_get_forecast_summary IS 'Returns daily forecast summaries for date range';


-- =============================================
-- DONE - Phase 2: RPC Functions
-- =============================================
