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
