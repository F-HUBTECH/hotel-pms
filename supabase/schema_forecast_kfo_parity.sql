-- RPC: Get Forecast by Room Type (Availability by Room Type tab in KFO)
CREATE OR REPLACE FUNCTION public.rpc_get_forecast_by_room_type(
  p_start_date DATE,
  p_end_date DATE,
  p_property_id UUID DEFAULT NULL
)
RETURNS TABLE (
  forecast_date DATE,
  room_type_id UUID,
  room_type_code TEXT,
  room_type_name TEXT,
  total_rooms INT,
  occupied_rooms INT,
  available_rooms INT,
  occupancy_percentage NUMERIC(5,2),
  stayover_rooms INT,
  arrival_rooms INT,
  departure_rooms INT,
  oo_rooms INT,
  oi_rooms INT,
  hu_rooms INT,
  comp_rooms INT,
  tentative_fit INT,
  tentative_grp INT,
  adult_pax INT,
  child_pax INT,
  total_pax INT,
  day_use_rooms INT,
  def_room_rev NUMERIC(12,2),
  def_avg_room_rev NUMERIC(10,2),
  ten_tot_room_rev NUMERIC(12,2),
  ten_avg_room_rev NUMERIC(10,2),
  tot_room_rev NUMERIC(12,2),
  avg_room_rate NUMERIC(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    frd.forecast_date,
    rt.id AS room_type_id,
    rt.code AS room_type_code,
    rt.name AS room_type_name,
    COUNT(*) AS total_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'occupied') AS occupied_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'available') AS available_rooms,
    CASE WHEN COUNT(*) > 0 THEN
      ROUND((COUNT(*) FILTER (WHERE frd.room_status = 'occupied')::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
    ELSE 0 END AS occupancy_percentage,
    COUNT(*) FILTER (WHERE frd.booking_status = 'I') AS stayover_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'B') AS arrival_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'O') AS departure_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'oo') AS oo_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'oi') AS oi_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'hu') AS hu_rooms,
    0 AS comp_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'B' AND frd.guest_type = 'FIT') AS tentative_fit,
    COUNT(*) FILTER (WHERE frd.booking_status = 'B' AND frd.guest_type = 'GRP') AS tentative_grp,
    COALESCE(SUM(frd.pax_adults), 0)::INT AS adult_pax,
    COALESCE(SUM(frd.pax_children), 0)::INT AS child_pax,
    COALESCE(SUM(frd.pax_adults + frd.pax_children), 0)::INT AS total_pax,
    0 AS day_use_rooms,
    COALESCE(SUM(frd.expected_room_revenue) FILTER (WHERE frd.forecast_type = 'confirmed'), 0) AS def_room_rev,
    CASE WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'confirmed') > 0 THEN
      ROUND(SUM(frd.expected_room_revenue) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'confirmed') / 
            COUNT(*) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'confirmed'), 2)
    ELSE 0 END AS def_avg_room_rev,
    COALESCE(SUM(frd.expected_room_revenue) FILTER (WHERE frd.forecast_type = 'projected'), 0) AS ten_tot_room_rev,
    CASE WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'projected') > 0 THEN
      ROUND(SUM(frd.expected_room_revenue) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'projected') / 
            COUNT(*) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'projected'), 2)
    ELSE 0 END AS ten_avg_room_rev,
    COALESCE(SUM(frd.expected_room_revenue), 0) AS tot_room_rev,
    CASE WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied') > 0 THEN
      ROUND(SUM(frd.expected_room_revenue) / COUNT(*) FILTER (WHERE frd.room_status = 'occupied'), 2)
    ELSE 0 END AS avg_room_rate
  FROM public.forecast_room_daily frd
  JOIN public.rooms r ON r.id = frd.room_id
  JOIN public.room_types rt ON rt.id = r.room_type_id
  WHERE frd.forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR r.property_id = p_property_id)
  GROUP BY frd.forecast_date, rt.id, rt.code, rt.name
  ORDER BY frd.forecast_date, rt.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get Forecast Occupied by Room Type (Occupied by Room Type tab in KFO)
CREATE OR REPLACE FUNCTION public.rpc_get_forecast_occupied_by_room_type(
  p_start_date DATE,
  p_end_date DATE,
  p_property_id UUID DEFAULT NULL
)
RETURNS TABLE (
  forecast_date DATE,
  room_type_id UUID,
  room_type_code TEXT,
  room_type_name TEXT,
  occupied_rooms INT,
  stayover_rooms INT,
  arrival_rooms INT,
  departure_rooms INT,
  fit_rooms INT,
  grp_rooms INT,
  hu_rooms INT,
  comp_rooms INT,
  adult_pax INT,
  child_pax INT,
  total_pax INT,
  room_revenue NUMERIC(12,2),
  extra_revenue NUMERIC(12,2),
  total_revenue NUMERIC(12,2),
  adr NUMERIC(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    frd.forecast_date,
    rt.id AS room_type_id,
    rt.code AS room_type_code,
    rt.name AS room_type_name,
    COUNT(*) FILTER (WHERE frd.room_status = 'occupied') AS occupied_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'I') AS stayover_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'B') AS arrival_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'O') AS departure_rooms,
    COUNT(*) FILTER (WHERE frd.guest_type = 'FIT' AND frd.room_status = 'occupied') AS fit_rooms,
    COUNT(*) FILTER (WHERE frd.guest_type = 'GRP' AND frd.room_status = 'occupied') AS grp_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'hu') AS hu_rooms,
    0 AS comp_rooms,
    COALESCE(SUM(frd.pax_adults) FILTER (WHERE frd.room_status = 'occupied'), 0)::INT AS adult_pax,
    COALESCE(SUM(frd.pax_children) FILTER (WHERE frd.room_status = 'occupied'), 0)::INT AS child_pax,
    COALESCE(SUM(frd.pax_adults + frd.pax_children) FILTER (WHERE frd.room_status = 'occupied'), 0)::INT AS total_pax,
    COALESCE(SUM(frd.expected_room_revenue) FILTER (WHERE frd.room_status = 'occupied'), 0) AS room_revenue,
    COALESCE(SUM(frd.expected_extra_revenue), 0) AS extra_revenue,
    COALESCE(SUM(frd.total_revenue) FILTER (WHERE frd.room_status = 'occupied'), 0) AS total_revenue,
    CASE WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied') > 0 THEN
      ROUND(SUM(frd.total_revenue) FILTER (WHERE frd.room_status = 'occupied') / 
            COUNT(*) FILTER (WHERE frd.room_status = 'occupied'), 2)
    ELSE 0 END AS adr
  FROM public.forecast_room_daily frd
  JOIN public.rooms r ON r.id = frd.room_id
  JOIN public.room_types rt ON rt.id = r.room_type_id
  WHERE frd.forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR r.property_id = p_property_id)
  GROUP BY frd.forecast_date, rt.id, rt.code, rt.name
  ORDER BY frd.forecast_date, rt.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get Forecast Summary with ALL KFO fields
CREATE OR REPLACE FUNCTION public.rpc_get_forecast_all(
  p_start_date DATE,
  p_end_date DATE,
  p_property_id UUID DEFAULT NULL,
  p_room_only BOOLEAN DEFAULT FALSE,
  p_revenue_incl_tentative BOOLEAN DEFAULT TRUE,
  p_include_noshow_rev BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  forecast_date DATE,
  total_rooms INT,
  stayover_rooms INT,
  arrival_rooms INT,
  departure_rooms INT,
  occ_rooms INT,
  occ_percentage NUMERIC(5,2),
  comp_rooms INT,
  hu_rooms INT,
  oo_rooms INT,
  oi_rooms INT,
  avl_rooms INT,
  f_tent INT,
  g_tent INT,
  occ_pct_tentative NUMERIC(5,2),
  avl_after_tentative INT,
  ad_pax INT,
  ch_pax INT,
  tot_pax INT,
  occ_pax INT,
  rm_sold INT,
  ocr_pct_sale NUMERIC(5,2),
  day_use INT,
  def_room_rev NUMERIC(12,2),
  def_avg_room_rev NUMERIC(10,2),
  ten_tot_room_rev NUMERIC(12,2),
  ten_avg_room_rev NUMERIC(10,2),
  tot_room_rev NUMERIC(12,2),
  avg_room_rate NUMERIC(10,2),
  -- Additional fields
  total_revenue NUMERIC(12,2),
  room_revenue NUMERIC(12,2),
  extra_revenue NUMERIC(12,2),
  fit_revenue NUMERIC(12,2),
  grp_revenue NUMERIC(12,2),
  adr NUMERIC(10,2),
  revpar NUMERIC(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    frd.forecast_date,
    COUNT(*)::INT AS total_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'I' AND frd.room_status = 'occupied') AS stayover_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'B') AS arrival_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'O') AS departure_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'occupied') AS occ_rooms,
    CASE WHEN COUNT(*) > 0 THEN
      ROUND((COUNT(*) FILTER (WHERE frd.room_status = 'occupied')::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
    ELSE 0 END AS occ_percentage,
    0 AS comp_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'hu') AS hu_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'oo') AS oo_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'oi') AS oi_rooms,
    COUNT(*) FILTER (WHERE frd.room_status = 'available') AS avl_rooms,
    COUNT(*) FILTER (WHERE frd.booking_status = 'B' AND frd.guest_type = 'FIT') AS f_tent,
    COUNT(*) FILTER (WHERE frd.booking_status = 'B' AND frd.guest_type = 'GRP') AS g_tent,
    CASE WHEN COUNT(*) > 0 THEN
      ROUND(((COUNT(*) FILTER (WHERE frd.room_status = 'occupied') + 
              COUNT(*) FILTER (WHERE frd.booking_status = 'B'))::NUMERIC / COUNT(*)::NUMERIC * 100), 2)
    ELSE 0 END AS occ_pct_tentative,
    COUNT(*) FILTER (WHERE frd.room_status = 'available') - 
      COUNT(*) FILTER (WHERE frd.booking_status = 'B') AS avl_after_tentative,
    COALESCE(SUM(frd.pax_adults), 0)::INT AS ad_pax,
    COALESCE(SUM(frd.pax_children), 0)::INT AS ch_pax,
    COALESCE(SUM(frd.pax_adults + frd.pax_children), 0)::INT AS tot_pax,
    COALESCE(SUM(frd.pax_adults + frd.pax_children) FILTER (WHERE frd.room_status = 'occupied'), 0)::INT AS occ_pax,
    (COUNT(*) - COUNT(*) FILTER (WHERE frd.room_status = 'oi'))::INT AS rm_sold,
    CASE WHEN (COUNT(*) - COUNT(*) FILTER (WHERE frd.room_status = 'oi')) > 0 THEN
      ROUND((COUNT(*) FILTER (WHERE frd.room_status = 'occupied')::NUMERIC / 
             (COUNT(*) - COUNT(*) FILTER (WHERE frd.room_status = 'oi'))::NUMERIC * 100), 2)
    ELSE 0 END AS ocr_pct_sale,
    0::INT AS day_use,
    COALESCE(SUM(frd.expected_room_revenue) FILTER (WHERE frd.forecast_type = 'confirmed'), 0) AS def_room_rev,
    CASE WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'confirmed') > 0 THEN
      ROUND(SUM(frd.expected_room_revenue) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'confirmed') / 
            COUNT(*) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'confirmed'), 2)
    ELSE 0 END AS def_avg_room_rev,
    COALESCE(SUM(frd.expected_room_revenue) FILTER (WHERE frd.forecast_type = 'projected'), 0) AS ten_tot_room_rev,
    CASE WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'projected') > 0 THEN
      ROUND(SUM(frd.expected_room_revenue) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'projected') / 
            COUNT(*) FILTER (WHERE frd.room_status = 'occupied' AND frd.forecast_type = 'projected'), 2)
    ELSE 0 END AS ten_avg_room_rev,
    COALESCE(SUM(frd.expected_room_revenue), 0) AS tot_room_rev,
    CASE WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied') > 0 THEN
      ROUND(SUM(frd.expected_room_revenue) / COUNT(*) FILTER (WHERE frd.room_status = 'occupied'), 2)
    ELSE 0 END AS avg_room_rate,
    -- Additional
    COALESCE(SUM(frd.total_revenue), 0) AS total_revenue,
    COALESCE(SUM(frd.expected_room_revenue), 0) AS room_revenue,
    COALESCE(SUM(frd.expected_extra_revenue), 0) AS extra_revenue,
    COALESCE(SUM(frd.total_revenue) FILTER (WHERE frd.guest_type = 'FIT'), 0) AS fit_revenue,
    COALESCE(SUM(frd.total_revenue) FILTER (WHERE frd.guest_type = 'GRP'), 0) AS grp_revenue,
    CASE WHEN COUNT(*) FILTER (WHERE frd.room_status = 'occupied') > 0 THEN
      ROUND(SUM(frd.total_revenue) / COUNT(*) FILTER (WHERE frd.room_status = 'occupied'), 2)
    ELSE 0 END AS adr,
    CASE WHEN COUNT(*) > 0 THEN
      ROUND(SUM(frd.total_revenue) / COUNT(*), 2)
    ELSE 0 END AS revpar
  FROM public.forecast_room_daily frd
  JOIN public.rooms r ON r.id = frd.room_id
  WHERE frd.forecast_date BETWEEN p_start_date AND p_end_date
    AND (p_property_id IS NULL OR r.property_id = p_property_id)
  GROUP BY frd.forecast_date
  ORDER BY frd.forecast_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
