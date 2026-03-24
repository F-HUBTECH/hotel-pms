CREATE OR REPLACE FUNCTION public.increment_allotment_used(
    p_allotment_id UUID,
    p_room_type_id UUID,
    p_date DATE,
    p_rooms INTEGER
) RETURNS void AS $$
BEGIN
    UPDATE public.allotment_daily
    SET used_rooms = used_rooms + p_rooms,
        updated_at = NOW()
    WHERE allotment_id = p_allotment_id
      AND room_type_id = p_room_type_id
      AND allott_date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrement_allotment_used(
    p_allotment_id UUID,
    p_room_type_id UUID,
    p_date DATE,
    p_rooms INTEGER
) RETURNS void AS $$
BEGIN
    UPDATE public.allotment_daily
    SET used_rooms = GREATEST(0, used_rooms - p_rooms),
        updated_at = NOW()
    WHERE allotment_id = p_allotment_id
      AND room_type_id = p_room_type_id
      AND allott_date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
