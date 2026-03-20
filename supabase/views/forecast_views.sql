-- =============================================
-- Hotel PMS - Forecast Views
-- KFO Parity - Room-by-Room Forecast Grid
-- =============================================

-- =============================================
-- 1. FORECAST ROOM GRID VIEW
-- Room-by-room, day-by-day forecast with all KFO features
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_room_grid AS
SELECT
  frd.forecast_date,
  frd.room_id,
  r.room_number,
  r.room_type_id,
  rt.name AS room_type_name,
  frd.building_id,
  b.name AS building_name,

  -- Status information
  frd.room_status,
  frd.booking_status,
  frd.is_available,
  rs.status_type AS room_status_type,
  rs.from_date AS room_status_from,
  rs.to_date AS room_status_to,
  rs.reason AS room_status_reason,

  -- Guest/Segment information
  frd.guest_type,
  frd.pax_adults,
  frd.pax_children,

  -- Booking information
  frd.reservation_id,
  frd.booking_status,
  rv.reservation_number,

  -- Rate information
  frd.rate_code,
  frd.rate_amount,
  frd.allot_code,
  a.company_name AS allotment_name,

  -- Revenue information
  frd.expected_revenue,
  frd.expected_room_revenue,
  frd.expected_extra_revenue,
  frd.total_revenue,

  -- Override information
  frd.is_override,
  frd.original_rate_amount,
  frd.original_revenue,
  frd.override_reason,

  -- Display metadata
  frd.is_override,
  frd.override_by,
  frd.override_at,
  frd.created_at,
  frd.updated_at

FROM public.forecast_room_daily frd
JOIN public.rooms r ON r.id = frd.room_id
LEFT JOIN public.room_types rt ON rt.id = r.room_type_id
LEFT JOIN public.buildings b ON b.id = r.building_id
LEFT JOIN public.room_status_dates rs ON rs.room_id = frd.room_id
  AND rs.status_type = frd.room_status
  AND rs.from_date <= frd.forecast_date
  AND rs.to_date >= frd.forecast_date
LEFT JOIN public.reservations rv ON rv.id = frd.reservation_id
LEFT JOIN public.corporate_allotments a ON a.allot_code = frd.allot_code
ORDER BY frd.forecast_date, b.name, r.room_number;

-- =============================================
-- 2. FORECAST SUMMARY COMPARISON VIEW
-- Forecast vs actual comparison with variance
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_summary_comparison AS
SELECT
  fs.forecast_date,

  -- Forecast values
  fs.total_rooms,
  fs.available_rooms,
  fs.occupied_rooms,
  fs.stayover_rooms,
  fs.arrival_rooms,
  fs.departure_rooms,

  -- Room status
  fs.oo_rooms,
  fs.oi_rooms,
  fs.hu_rooms,
  fs.complimentary_rooms,

  -- Occupancy
  fs.occupancy_percentage,
  fs.rooms_sold,

  -- Forecast revenue
  fs.total_revenue,
  fs.room_revenue,
  fs.extra_revenue,
  fs.fit_revenue,
  fs.grp_revenue,

  -- KPIs
  fs.adr,
  fs.revpar,

  -- Actual values
  COALESCE(fs.actual_rooms_sold, 0) AS actual_rooms_sold,
  COALESCE(fs.actual_revenue, 0) AS actual_revenue,
  COALESCE(fs.actual_room_revenue, 0) AS actual_room_revenue,
  COALESCE(fs.actual_adr, 0) AS actual_adr,
  COALESCE(fs.actual_revpar, 0) AS actual_revpar,

  -- Variance
  COALESCE(fs.revenue_variance, 0) AS revenue_variance,
  CASE WHEN fs.total_revenue > 0 AND fs.actual_revenue > 0
    THEN ROUND(ABS(fs.actual_revenue - fs.total_revenue) / fs.total_revenue * 100, 2)
    ELSE 0
  END AS revenue_variance_percentage,

  -- Accuracy
  CASE WHEN fs.total_revenue > 0 AND fs.actual_revenue > 0
    THEN ROUND(100 - ABS(fs.actual_revenue - fs.total_revenue) / fs.total_revenue * 100, 2)
    ELSE 0
  END AS accuracy_percentage,

  -- Status tracking
  fs.created_at,
  fs.updated_at

FROM public.forecast_summary_daily fs
ORDER BY fs.forecast_date DESC;

-- =============================================
-- 3. FORECAST BY ROOM TYPE VIEW
-- Room type breakdown for analysis
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_by_room_type AS
WITH daily_room_type_stats AS (
  SELECT
    frd.forecast_date,
    frd.room_type_id,
    rt.name AS room_type_name,

    -- Room counts
    COUNT(*) AS total_rooms,
    COUNT(CASE WHEN frd.is_available THEN 1 END) AS available_rooms,
    COUNT(CASE WHEN frd.room_status = 'occupied' THEN 1 END) AS occupied_rooms,
    COUNT(CASE WHEN frd.booking_status = 'booked' THEN 1 END) AS booked_rooms,

    -- Revenue breakdown
    COALESCE(SUM(frd.expected_room_revenue), 0) AS room_revenue,
    COALESCE(SUM(frd.expected_extra_revenue), 0) AS extra_revenue,
    COALESCE(SUM(frd.total_revenue), 0) AS total_revenue

  FROM public.forecast_room_daily frd
  LEFT JOIN public.room_types rt ON rt.id = frd.room_type_id
  WHERE frd.forecast_date >= CURRENT_DATE
  GROUP BY frd.forecast_date, frd.room_type_id, rt.name
)
SELECT
  forecast_date,
  room_type_id,
  room_type_name,

  -- Occupancy metrics
  SUM(total_rooms) AS total_rooms,
  SUM(available_rooms) AS available_rooms,
  SUM(occupied_rooms) AS occupied_rooms,
  SUM(booked_rooms) AS booked_rooms,

  -- Occupancy percentage
  CASE
    WHEN SUM(total_rooms) > 0
    THEN ROUND(SUM(occupied_rooms + booked_rooms) / SUM(total_rooms) * 100, 2)
    ELSE 0
  END AS occupancy_percentage,

  -- Revenue metrics
  SUM(room_revenue) AS room_revenue,
  SUM(extra_revenue) AS extra_revenue,
  SUM(total_revenue) AS total_revenue,

  -- KPIs
  CASE
    WHEN SUM(occupied_rooms + booked_rooms) > 0
    THEN ROUND(SUM(total_revenue) / SUM(occupied_rooms + booked_rooms), 2)
    ELSE 0
  END AS room_adr,

  CASE
    WHEN SUM(total_rooms) > 0
    THEN ROUND(SUM(total_revenue) / SUM(total_rooms), 2)
    ELSE 0
  END AS room_revpar

FROM daily_room_type_stats
ORDER BY forecast_date DESC, room_type_name;

-- =============================================
-- 4. FORECAST BY BUILDING VIEW
-- Building breakdown for analysis
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_by_building AS
WITH daily_building_stats AS (
  SELECT
    frd.forecast_date,
    frd.building_id,
    b.name AS building_name,

    -- Room counts
    COUNT(*) AS total_rooms,
    COUNT(CASE WHEN frd.is_available THEN 1 END) AS available_rooms,
    COUNT(CASE WHEN frd.room_status = 'occupied' THEN 1 END) AS occupied_rooms,
    COUNT(CASE WHEN frd.booking_status = 'booked' THEN 1 END) AS booked_rooms,

    -- Revenue breakdown
    COALESCE(SUM(frd.expected_room_revenue), 0) AS room_revenue,
    COALESCE(SUM(frd.expected_extra_revenue), 0) AS extra_revenue,
    COALESCE(SUM(frd.total_revenue), 0) AS total_revenue

  FROM public.forecast_room_daily frd
  LEFT JOIN public.buildings b ON b.id = frd.building_id
  WHERE frd.forecast_date >= CURRENT_DATE
  GROUP BY frd.forecast_date, frd.building_id, b.name
)
SELECT
  forecast_date,
  building_id,
  building_name,

  -- Occupancy metrics
  SUM(total_rooms) AS total_rooms,
  SUM(available_rooms) AS available_rooms,
  SUM(occupied_rooms) AS occupied_rooms,
  SUM(booked_rooms) AS booked_rooms,

  -- Occupancy percentage
  CASE
    WHEN SUM(total_rooms) > 0
    THEN ROUND(SUM(occupied_rooms + booked_rooms) / SUM(total_rooms) * 100, 2)
    ELSE 0
  END AS occupancy_percentage,

  -- Revenue metrics
  SUM(room_revenue) AS room_revenue,
  SUM(extra_revenue) AS extra_revenue,
  SUM(total_revenue) AS total_revenue,

  -- KPIs
  CASE
    WHEN SUM(occupied_rooms + booked_rooms) > 0
    THEN ROUND(SUM(total_revenue) / SUM(occupied_rooms + booked_rooms), 2)
    ELSE 0
  END AS building_adr,

  CASE
    WHEN SUM(total_rooms) > 0
    THEN ROUND(SUM(total_revenue) / SUM(total_rooms), 2)
    ELSE 0
  END AS building_revpar

FROM daily_building_stats
ORDER BY forecast_date DESC, building_name;

-- =============================================
-- 5. FORECAST ADJUSTMENT HISTORY VIEW
-- Audit trail for manual forecast adjustments
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_adjustment_history AS
SELECT
  frd.id,
  frd.forecast_date,
  r.room_number,
  r.room_type_id,
  rt.name AS room_type_name,

  -- Original values
  frd.original_rate_amount,
  frd.original_revenue,

  -- Override values
  frd.rate_amount,
  frd.expected_revenue,

  -- Adjustment info
  frd.is_override,
  frd.override_reason,
  frd.override_by,
  frd.override_at,

  -- User info
  p1.full_name AS overridden_by_name,

  -- Metadata
  frd.created_at,
  frd.updated_at

FROM public.forecast_room_daily frd
JOIN public.rooms r ON r.id = frd.room_id
LEFT JOIN public.room_types rt ON rt.id = r.room_type_id
LEFT JOIN public.profiles p1 ON p1.id = frd.override_by
WHERE frd.is_override = true
  AND frd.forecast_date >= CURRENT_DATE - INTERVAL '180 days'  -- Last 6 months
ORDER BY frd.forecast_date DESC, frd.override_at DESC;

-- =============================================
-- 6. FORECAST SUMMARY BY PROPERTY VIEW
-- Multi-property comparison dashboard
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_summary_by_property AS
WITH property_forecasts AS (
  SELECT
    fs.forecast_date,
    p.id AS property_id,
    p.name AS property_name,
    p.code AS property_code,

    -- 30-day averages
    AVG(fs.occupancy_percentage) OVER (PARTITION BY p.id ORDER BY fs.forecast_date DESC ROWS BETWEEN UNBOUNDED (6) AND PRECEDING) FOLLOWING) AS avg_occupancy,
    AVG(fs.rooms_sold) OVER (PARTITION BY p.id ORDER BY fs.forecast_date DESC ROWS BETWEEN UNBOUNDED (6) AND PRECEDING) FOLLOWING) AS avg_rooms_sold,
    AVG(fs.adr) OVER (PARTITION BY p.id ORDER BY fs.forecast_date DESC ROWS BETWEEN UNBOUNDED (6) AND PRECEDING) FOLLOWING) AS avg_adr,
    AVG(fs.revpar) OVER (PARTITION BY p.id ORDER BY fs.forecast_date DESC ROWS BETWEEN UNBOUNDED (6) AND PRECEDING) FOLLOWING) AS avg_revpar,

    -- Total revenue
    SUM(fs.total_revenue) OVER (PARTITION BY p.id ORDER BY fs.forecast_date DESC ROWS BETWEEN UNBOUNDED (6) AND PRECEDING) FOLLOWING) AS total_revenue,
    SUM(fs.room_revenue) OVER (PARTITION BY p.id ORDER BY fs.forecast_date DESC ROWS BETWEEN UNBOUNDED (6) AND PRECEDING) FOLLOWING) AS room_revenue,
    SUM(fs.extra_revenue) OVER (PARTITION BY p.id ORDER BY fs.forecast_date DESC ROWS BETWEEN UNBOUNDED (6) AND PRECEDING) FOLLOWING) AS extra_revenue,
    SUM(fs.fit_revenue) OVER (PARTITION BY p.id ORDER BY fs.forecast_date DESC ROWS BETWEEN UNBOUNDED (6) AND PRECEDING FOLLOWING) AS fit_revenue,
    SUM(fs.grp_revenue) OVER (PARTITION BY p.id ORDER BY fs.forecast_date DESC ROWS BETWEEN UNBOUNDED(6) AND PRECEDING) FOLLOWING) AS grp_revenue

  FROM public.forecast_summary_daily fs
  JOIN public.properties p ON p.id = fs.property_id
  WHERE fs.forecast_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY fs.forecast_date, p.id, p.name, p.code
)
SELECT
  forecast_date,
  property_id,
  property_name,
  property_code,

  -- Average metrics
  ROUND(avg_occupancy, 1) AS avg_occupancy_percentage,
  ROUND(avg_rooms_sold, 1) AS avg_rooms_sold,
  ROUND(avg_adr, 0) AS avg_adr,
  ROUND(avg_revpar, 0) AS avg_revpar,

  -- Total revenue
  ROUND(total_revenue, 2) AS total_revenue,
  ROUND(room_revenue, 2) AS room_revenue,
  ROUND(extra_revenue, 2) AS extra_revenue,
  ROUND(fit_revenue, 2) AS fit_revenue,
  ROUND(grp_revenue, 2) AS grp_revenue

FROM property_forecasts
ORDER BY forecast_date DESC, property_name;

-- =============================================
-- DONE: Forecast Views
-- =============================================
