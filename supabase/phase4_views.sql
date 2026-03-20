-- =============================================
-- Hotel PMS - Phase 4: Forecast Views
-- Schema V11 - Views for Forecast Display & Reporting
-- =============================================

-- =============================================
-- 1. V_FORECAST_ROOM_GRID
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_room_grid AS
SELECT
  f.forecast_date,
  r.room_number,
  r.room_number || ' (' || rt.name || ')' AS room_label,
  b.name AS building_name,
  b.id AS building_id,
  rt.name AS room_type_name,
  rt.id AS room_type_id,
  rt.code AS room_type_code,

  -- Status
  f.room_status,
  f.booking_status,
  f.guest_type,
  f.pax_adults,
  f.pax_children,
  f.pax_adults + f.pax_children AS total_pax,

  -- Rates
  f.rate_code,
  f.rate_amount,
  a.allot_code,
  a.allot_name AS allot_name,

  -- Revenue
  f.expected_room_revenue,
  f.expected_extra_revenue,
  f.total_revenue,
  f.expected_revenue,

  -- Display
  f.is_override,
  f.override_reason,
  f.override_by,
  f.override_at,

  -- Forecast metadata
  f.forecast_type,
  f.reservation_id,
  res.reservation_number,
  res.check_in_date,
  res.check_out_date,

  -- Room info
  r.status AS actual_room_status,
  rsd.status_type AS room_status_type,
  rsd.from_date AS status_from_date,
  rsd.to_date AS status_to_date,

  -- IDs
  f.id AS forecast_id,
  f.room_id AS room_id,

  -- Computed fields
  CASE
    WHEN f.is_override THEN (f.total_revenue - f.original_revenue) / NULLIF(f.original_revenue, 0) * 100
    ELSE 0
  END AS revenue_change_percentage,

  CASE
    WHEN f.guest_type = 'GRP' THEN f.total_revenue
    ELSE 0
  END AS grp_revenue_amount,

  CASE
    WHEN f.guest_type = 'FIT' THEN f.total_revenue
    ELSE 0
  END AS fit_revenue_amount

FROM forecast_room_daily f
JOIN rooms r ON r.id = f.room_id
LEFT JOIN room_types rt ON r.room_type_id = rt.id
LEFT JOIN buildings b ON r.building_id = b.id
LEFT JOIN reservations res ON res.id = f.reservation_id
LEFT JOIN corporate_allotments a ON a.allot_code = f.allot_code
LEFT JOIN room_status_dates rsd ON rsd.room_id = r.id
  AND rsd.status_type = f.room_status
  AND rsd.from_date <= f.forecast_date
  AND rsd.to_date >= f.forecast_date
ORDER BY f.forecast_date, r.room_number;

COMMENT ON VIEW public.v_forecast_room_grid IS 'Room-by-room forecast grid display with full details and computed fields';


-- =============================================
-- 2. V_FORECAST_SUMMARY_COMPARISON
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_summary_comparison AS
SELECT
  fs.forecast_date,
  fs.property_id,
  p.name AS property_name,

  -- Room counts
  fs.total_rooms,
  fs.available_rooms,
  fs.occupied_rooms,
  fs.stayover_rooms,
  fs.arrival_rooms,
  fs.departure_rooms,
  fs.rooms_sold,

  -- Room status breakdown
  fs.oo_rooms,
  fs.oi_rooms,
  fs.hu_rooms,
  fs.complimentary_rooms,
  fs.oo_rooms + fs.oi_rooms + fs.hu_rooms AS unavailable_rooms,

  -- Occupancy metrics
  fs.occupancy_percentage,
  CASE
    WHEN fs.total_rooms > 0 THEN
      ROUND((fs.total_rooms - fs.available_rooms)::NUMERIC / fs.total_rooms::NUMERIC * 100, 2)
    ELSE 0
  END AS occupancy_sold_percentage,

  -- Forecast revenue
  fs.total_revenue AS forecast_revenue,
  fs.room_revenue AS forecast_room_revenue,
  fs.extra_revenue AS forecast_extra_revenue,
  fs.fit_revenue AS forecast_fit_revenue,
  fs.grp_revenue AS forecast_grp_revenue,

  -- Actual revenue (when available)
  COALESCE(fs.actual_revenue, 0) AS actual_revenue,
  COALESCE(fs.actual_room_revenue, 0) AS actual_room_revenue,
  COALESCE(fs.actual_extra_revenue, 0) AS actual_extra_revenue,

  -- Variance
  (COALESCE(fs.actual_revenue, 0) - fs.total_revenue) AS revenue_variance,
  CASE
    WHEN fs.total_revenue > 0 THEN
      ROUND((COALESCE(fs.actual_revenue, 0) - fs.total_revenue) / fs.total_revenue * 100, 2)
    ELSE 0
  END AS variance_percentage,

  -- Absolute variance
  ABS(COALESCE(fs.actual_revenue, 0) - fs.total_revenue) AS absolute_variance,

  -- KPIs comparison
  fs.adr AS forecast_adr,
  COALESCE(fs.actual_adr, 0) AS actual_adr,
  (COALESCE(fs.actual_adr, 0) - fs.adr) AS adr_variance,
  fs.revpar AS forecast_revpar,
  COALESCE(fs.actual_revpar, 0) AS actual_revpar,
  (COALESCE(fs.actual_revpar, 0) - fs.revpar) AS revpar_variance,

  -- Accuracy tracking
  CASE
    WHEN fs.total_revenue > 0 THEN
      ROUND(ABS(COALESCE(fs.actual_revenue, 0) - fs.total_revenue) / fs.total_revenue * 100, 2)
    ELSE 0
  END AS accuracy_percentage,

  -- Classification
  CASE
    WHEN fs.actual_revenue IS NULL THEN 'forecast'
    WHEN fs.total_revenue = 0 AND COALESCE(fs.actual_revenue, 0) = 0 THEN 'both_zero'
    WHEN ABS((COALESCE(fs.actual_revenue, 0) - fs.total_revenue) / NULLIF(fs.total_revenue, 0)) <= 0.05 THEN 'excellent'
    WHEN ABS((COALESCE(fs.actual_revenue, 0) - fs.total_revenue) / NULLIF(fs.total_revenue, 0)) <= 0.10 THEN 'good'
    WHEN ABS((COALESCE(fs.actual_revenue, 0) - fs.total_revenue) / NULLIF(fs.total_revenue, 0)) <= 0.20 THEN 'fair'
    ELSE 'poor'
  END AS accuracy_classification,

  -- Segment analysis
  CASE
    WHEN fs.total_revenue > 0 THEN
      ROUND(fs.fit_revenue / fs.total_revenue * 100, 2)
    ELSE 0
  END AS fit_percentage,
  CASE
    WHEN fs.total_revenue > 0 THEN
      ROUND(fs.grp_revenue / fs.total_revenue * 100, 2)
    ELSE 0
  END AS grp_percentage,

  -- Revenue per room
  CASE
    WHEN fs.occupied_rooms > 0 THEN
      ROUND(fs.total_revenue / fs.occupied_rooms, 2)
    ELSE 0
  END AS revenue_per_occupied_room,
  CASE
    WHEN fs.total_rooms > 0 THEN
      ROUND(fs.total_revenue / fs.total_rooms, 2)
    ELSE 0
  END AS revenue_per_available_room,

  -- Timestamps
  fs.created_at,
  fs.updated_at

FROM forecast_summary_daily fs
LEFT JOIN properties p ON p.id = fs.property_id
ORDER BY fs.forecast_date DESC;

COMMENT ON VIEW public.v_forecast_summary_comparison IS 'Daily forecast summary with actual comparison, variance, and accuracy tracking';


-- =============================================
-- 3. V_FORECAST_BY_ROOM_TYPE
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_by_room_type AS
SELECT
  frd.forecast_date,
  rt.id AS room_type_id,
  rt.code AS room_type_code,
  rt.name AS room_type_name,
  b.id AS property_id,
  b.name AS property_name,

  -- Counts
  COUNT(*) AS total_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'available') AS available_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'occupied') AS occupied_rooms,
  COUNT(*) FILTER (WHERE frd.booking_status = 'B') AS arrival_rooms,
  COUNT(*) FILTER (WHERE frd.booking_status = 'I') AS stayover_rooms,
  COUNT(*) FILTER (WHERE frd.booking_status = 'O') AS departure_rooms,

  -- Revenue
  COALESCE(SUM(frd.total_revenue), 0) AS total_revenue,
  COALESCE(SUM(frd.expected_room_revenue), 0) AS room_revenue,
  COALESCE(SUM(frd.expected_extra_revenue), 0) AS extra_revenue,

  -- Segment breakdown
  COALESCE(SUM(frd.total_revenue) FILTER (WHERE frd.guest_type = 'FIT'), 0) AS fit_revenue,
  COALESCE(SUM(frd.total_revenue) FILTER (WHERE frd.guest_type = 'GRP'), 0) AS grp_revenue,

  -- ADR
  CASE
    WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied') > 0 THEN
      ROUND(SUM(frd.total_revenue) FILTER (WHERE frd.room_status = 'occupied') /
            COUNT(*) FILTER (WHERE frd.room_status = 'occupied'), 2)
    ELSE 0
  END AS adr,

  -- Occupancy
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(COUNT(*) FILTER (WHERE frd.room_status = 'occupied')::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
    ELSE 0
  END AS occupancy_percentage,

  -- Override tracking
  COUNT(*) FILTER (WHERE frd.is_override) AS override_count,
  COALESCE(SUM(CASE WHEN frd.is_override THEN (frd.total_revenue - frd.original_revenue) ELSE 0 END), 0) AS override_adjustment

FROM forecast_room_daily frd
JOIN rooms r ON r.id = frd.room_id
JOIN room_types rt ON rt.id = r.room_type_id
JOIN buildings b ON b.id = r.building_id
GROUP BY
  frd.forecast_date,
  rt.id,
  rt.code,
  rt.name,
  b.id,
  b.name
ORDER BY
  frd.forecast_date,
  rt.name;

COMMENT ON VIEW public.v_forecast_by_room_type IS 'Forecast aggregated by room type for analysis';


-- =============================================
-- 4. V_FORECAST_BY_BUILDING
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_by_building AS
SELECT
  frd.forecast_date,
  b.id AS building_id,
  b.name AS building_name,
  b.id AS property_id,
  p.name AS property_name,

  -- Counts
  COUNT(*) AS total_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'available') AS available_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'occupied') AS occupied_rooms,
  COUNT(*) FILTER (WHERE frd.booking_status = 'B') AS arrival_rooms,
  COUNT(*) FILTER (WHERE frd.booking_status = 'I') AS stayover_rooms,
  COUNT(*) FILTER (WHERE frd.booking_status = 'O') AS departure_rooms,

  -- Room status breakdown
  COUNT(*) FILTER (WHERE frd.room_status = 'oo') AS oo_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'oi') AS oi_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'hu') AS hu_rooms,

  -- Revenue
  COALESCE(SUM(frd.total_revenue), 0) AS total_revenue,
  COALESCE(SUM(frd.expected_room_revenue), 0) AS room_revenue,
  COALESCE(SUM(frd.expected_extra_revenue), 0) AS extra_revenue,

  -- Segment breakdown
  COALESCE(SUM(frd.total_revenue) FILTER (WHERE frd.guest_type = 'FIT'), 0) AS fit_revenue,
  COALESCE(SUM(frd.total_revenue) FILTER (WHERE frd.guest_type = 'GRP'), 0) AS grp_revenue,

  -- ADR
  CASE
    WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied') > 0 THEN
      ROUND(SUM(frd.total_revenue) FILTER (WHERE frd.room_status = 'occupied') /
            COUNT(*) FILTER (WHERE frd.room_status = 'occupied'), 2)
    ELSE 0
  END AS adr,

  -- RevPAR
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(SUM(frd.total_revenue) / COUNT(*), 2)
    ELSE 0
  END AS revpar,

  -- Occupancy
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(COUNT(*) FILTER (WHERE frd.room_status = 'occupied')::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
    ELSE 0
  END AS occupancy_percentage,

  -- Override tracking
  COUNT(*) FILTER (WHERE frd.is_override) AS override_count,
  COALESCE(SUM(CASE WHEN frd.is_override THEN (frd.total_revenue - frd.original_revenue) ELSE 0 END), 0) AS override_adjustment

FROM forecast room_daily frd
JOIN rooms r ON r.id = frd.room_id
JOIN buildings b ON b.id = r.building_id
LEFT JOIN properties p ON p.id = b.property_id
GROUP BY
  frd.forecast_date,
  b.id,
  b.name,
  p.id,
  p.name
ORDER BY
  frd.forecast_date,
  b.name;

COMMENT ON VIEW public.v_forecast_by_building IS 'Forecast aggregated by building for analysis';

-- Fix typo in the query
CREATE OR REPLACE VIEW public.v_forecast_by_building AS
SELECT
  frd.forecast_date,
  b.id AS building_id,
  b.name AS building_name,
  b.id AS property_id,
  p.name AS property_name,

  -- Counts
  COUNT(*) AS total_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'available') AS available_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'occupied') AS occupied_rooms,
  COUNT(*) FILTER (WHERE frd.booking_status = 'B') AS arrival_rooms,
  COUNT(*) FILTER (WHERE frd.booking_status = 'I') AS stayover_rooms,
  COUNT(*) FILTER (WHERE frd.booking_status = 'O') AS departure_rooms,

  -- Room status breakdown
  COUNT(*) FILTER (WHERE frd.room_status = 'oo') AS oo_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'oi') AS oi_rooms,
  COUNT(*) FILTER (WHERE frd.room_status = 'hu') AS hu_rooms,

  -- Revenue
  COALESCE(SUM(frd.total_revenue), 0) AS total_revenue,
  COALESCE(SUM(frd.expected_room_revenue), 0) AS room_revenue,
  COALESCE(SUM(frd.expected_extra_revenue), 0) AS extra_revenue,

  -- Segment breakdown
  COALESCE(SUM(frd.total_revenue) FILTER (WHERE frd.guest_type = 'FIT'), 0) AS fit_revenue,
  COALESCE(SUM(frd.total_revenue) FILTER (WHERE frd.guest_type = 'GRP'), 0) AS grp_revenue,

  -- ADR
  CASE
    WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied') > 0 THEN
      ROUND(SUM(frd.total_revenue) FILTER (WHERE frd.room_status = 'occupied') /
            COUNT(*) FILTER (WHERE frd.room_status = 'occupied'), 2)
    ELSE 0
  END AS adr,

  -- RevPAR
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(SUM(frd.total_revenue) / COUNT(*), 2)
    ELSE 0
  END AS revpar,

  -- Occupancy
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(COUNT(*) FILTER (WHERE frd.room_status = 'occupied')::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
    ELSE 0
  END AS occupancy_percentage,

  -- Override tracking
  COUNT(*) FILTER (WHERE frd.is_override) AS override_count,
  COALESCE(SUM(CASE WHEN frd.is_override THEN (frd.total_revenue - frd.original_revenue) ELSE 0 END), 0) AS override_adjustment

FROM forecast_room_daily frd
JOIN rooms r ON r.id = frd.room_id
JOIN buildings b ON b.id = r.building_id
LEFT JOIN properties p ON p.id = b.property_id
GROUP BY
  frd.forecast_date,
  b.id,
  b.name,
  p.id,
  p.name
ORDER BY
  frd.forecast_date,
  b.name;

COMMENT ON VIEW public.v_forecast_by_building IS 'Forecast aggregated by building for analysis';


-- =============================================
-- 5. V_FORECAST_DAILY_SUMMARY_EXTENDED
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_daily_summary_extended AS
SELECT
  fs.forecast_date,
  fs.property_id,
  p.name AS property_name,

  -- Basic metrics
  fs.total_rooms,
  fs.available_rooms,
  fs.occupied_rooms,
  fs.occupancy_percentage,
  fs.rooms_sold,

  -- Revenue
  fs.total_revenue,
  fs.room_revenue,
  fs.extra_revenue,
  fs.fit_revenue,
  fs.grp_revenue,

  -- KPIs
  fs.adr,
  fs.revpar,

  -- Day of week and weekend indicator
  EXTRACT(ISODOW FROM fs.forecast_date) AS day_of_week,
  CASE
    WHEN EXTRACT(ISODOW FROM fs.forecast_date) IN (0, 6) THEN TRUE
    ELSE FALSE
  END AS is_weekend,
  TO_CHAR(fs.forecast_date, 'Day') AS day_name,

  -- Week number
  EXTRACT(WEEK FROM fs.forecast_date) AS week_number,
  EXTRACT(YEAR FROM fs.forecast_date) AS year,

  -- Month
  EXTRACT(MONTH FROM fs.forecast_date) AS month,
  TO_CHAR(fs.forecast_date, 'YYYY-MM') AS month_year,

  -- Comparison with previous day
  LAG(fs.occupancy_percentage) OVER (ORDER BY fs.forecast_date) AS prev_day_occupancy,
  fs.occupancy_percentage - LAG(fs.occupancy_percentage) OVER (ORDER BY fs.forecast_date) AS occupancy_change_pct,

  LAG(fs.total_revenue) OVER (ORDER BY fs.forecast_date) AS prev_day_revenue,
  fs.total_revenue - LAG(fs.total_revenue) OVER (ORDER BY fs.forecast_date) AS revenue_change,
  CASE
    WHEN LAG(fs.total_revenue) OVER (ORDER BY fs.forecast_date) > 0 THEN
      ROUND((fs.total_revenue - LAG(fs.total_revenue) OVER (ORDER BY fs.forecast_date)) /
            LAG(fs.total_revenue) OVER (ORDER BY fs.forecast_date) * 100, 2)
    ELSE 0
  END AS revenue_change_pct,

  -- Room type breakdown
  rt_count.standard_rooms,
  rt_count.deluxe_rooms,
  rt_count.suite_rooms,
  rt_count.other_rooms,

  -- Building breakdown
  b_count.building_a_rooms,
  b_count.building_b_rooms,
  b_count.building_c_rooms,

  -- Timestamps
  fs.created_at,
  fs.updated_at

FROM forecast_summary_daily fs
LEFT JOIN properties p ON p.id = fs.property_id

-- Room type counts for the date
LEFT JOIN (
  SELECT
    frd.forecast_date,
    COUNT(*) FILTER (WHERE rt.code = 'STD') AS standard_rooms,
    COUNT(*) FILTER (WHERE rt.code = 'DLX') AS deluxe_rooms,
    COUNT(*) FILTER (WHERE rt.code = 'SUITE') AS suite_rooms,
    COUNT(*) FILTER (WHERE rt.code NOT IN ('STD', 'DLX', 'SUITE')) AS other_rooms
  FROM forecast_room_daily frd
  JOIN rooms r ON r.id = frd.room_id
  JOIN room_types rt ON rt.id = r.room_type_id
  WHERE frd.room_status = 'occupied'
  GROUP BY frd.forecast_date
) rt_count ON rt_count.forecast_date = fs.forecast_date

-- Building counts for the date
LEFT JOIN (
  SELECT
    frd.forecast_date,
    COUNT(*) FILTER (WHERE b.name LIKE '%A%') AS building_a_rooms,
    COUNT(*) FILTER (WHERE b.name LIKE '%B%') AS building_b_rooms,
    COUNT(*) FILTER (WHERE b.name LIKE '%C%') AS building_c_rooms
  FROM forecast_room_daily frd
  JOIN rooms r ON r.id = frd.room_id
  JOIN buildings b ON b.id = r.building_id
  WHERE frd.room_status = 'occupied'
  GROUP BY frd.forecast_date
) b_count ON b_count.forecast_date = fs.forecast_date

ORDER BY fs.forecast_date DESC;

COMMENT ON VIEW public.v_forecast_daily_summary_extended IS 'Extended daily forecast summary with trends, day of week, and breakdown analysis';


-- =============================================
-- 6. V_FORECAST_ADJUSTMENT_HISTORY
-- =============================================
CREATE OR REPLACE VIEW public.v_forecast_adjustment_history AS
SELECT
  frd.id,
  frd.forecast_date,
  r.room_number,
  r.room_number || ' (' || rt.name || ')' AS room_label,
  b.name AS building_name,
  rt.name AS room_type_name,

  -- Original values
  frd.original_rate_amount,
  frd.original_revenue,

  -- New values
  frd.rate_amount AS new_rate_amount,
  frd.total_revenue AS new_revenue,

  -- Change calculations
  (frd.total_revenue - frd.original_revenue) AS revenue_change,
  CASE
    WHEN frd.original_revenue > 0 THEN
      ROUND((frd.total_revenue - frd.original_revenue) / frd.original_revenue * 100, 2)
    ELSE 0
  END AS revenue_change_percentage,
  (frd.rate_amount - frd.original_rate_amount) AS rate_change,
  CASE
    WHEN frd.original_rate_amount > 0 THEN
      ROUND((frd.rate_amount - frd.original_rate_amount) / frd.original_rate_amount * 100, 2)
    ELSE 0
  END AS rate_change_percentage,

  -- Override info
  frd.override_reason,
  frd.override_by,
  frd.override_at,

  -- User info
  pr.first_name || ' ' || COALESCE(pr.last_name, '') AS overridden_by_name,
  pr.email AS overridden_by_email,

  -- Time since override
  ROUND(EXTRACT(EPOCH FROM (NOW() - frd.override_at)) / 3600, 1) AS hours_since_override,

  -- Timestamps
  frd.created_at,
  frd.updated_at

FROM forecast_room_daily frd
JOIN rooms r ON r.id = frd.room_id
LEFT JOIN room_types rt ON rt.id = r.room_type_id
LEFT JOIN buildings b ON b.id = r.building_id
LEFT JOIN profiles pr ON pr.id = frd.override_by
WHERE frd.is_override = TRUE
ORDER BY frd.override_at DESC;

COMMENT ON VIEW public.v_forecast_adjustment_history IS 'History of all forecast adjustments with change calculations and user tracking';


-- =============================================
-- DONE - Phase 4: Views
-- =============================================
