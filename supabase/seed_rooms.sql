-- SQL Seed Script for Sample Room Data
-- Run this in Supabase Dashboard → SQL Editor
-- This creates sample rooms for testing the Room Chart

-- 1. Create Property (if not exists)
INSERT INTO properties (code, name, address, phone, email, timezone, currency)
VALUES ('MAIN', 'Main Hotel', '123 Hotel Street', '+66 2 123 4567', 'info@hotel.com', 'Asia/Bangkok', 'THB')
ON CONFLICT (code) DO NOTHING;

-- Get property ID
DO $$
DECLARE
    prop_id UUID;
    building_a_id UUID;
    building_b_id UUID;
    std_type_id UUID;
    dlx_type_id UUID;
    sui_type_id UUID;
    fam_type_id UUID;
    floor_a_g UUID;
    floor_a_2 UUID;
    floor_a_3 UUID;
    floor_a_4 UUID;
    floor_b_g UUID;
    floor_b_2 UUID;
BEGIN
    SELECT id INTO prop_id FROM properties WHERE code = 'MAIN' LIMIT 1;

    -- 2. Create Buildings
    INSERT INTO buildings (property_id, code, name, description)
    VALUES 
        (prop_id, 'A', 'Building A - Main Tower', 'Main hotel tower with sea view'),
        (prop_id, 'B', 'Building B - Garden Wing', 'Garden wing with pool access')
    ON CONFLICT (property_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO building_a_id;
    
    SELECT id INTO building_a_id FROM buildings WHERE code = 'A' AND property_id = prop_id;
    SELECT id INTO building_b_id FROM buildings WHERE code = 'B' AND property_id = prop_id;

    -- 3. Create Room Types
    INSERT INTO room_types (code, name, description, base_price)
    VALUES 
        ('STD', 'Standard Room', 'Comfortable standard room', 1500),
        ('DLX', 'Deluxe Room', 'Spacious deluxe room with balcony', 2500),
        ('SUI', 'Suite', 'Luxury suite with living room', 4500),
        ('FAM', 'Family Room', 'Large room for families', 3500)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id;

    SELECT id INTO std_type_id FROM room_types WHERE code = 'STD';
    SELECT id INTO dlx_type_id FROM room_types WHERE code = 'DLX';
    SELECT id INTO sui_type_id FROM room_types WHERE code = 'SUI';
    SELECT id INTO fam_type_id FROM room_types WHERE code = 'FAM';

    -- 4. Create Floor Plans
    INSERT INTO floor_plans (building_id, code, name)
    VALUES 
        (building_a_id, 'G', 'Ground Floor'),
        (building_a_id, '2', '2nd Floor'),
        (building_a_id, '3', '3rd Floor'),
        (building_a_id, '4', '4th Floor'),
        (building_b_id, 'G', 'Ground Floor'),
        (building_b_id, '2', '2nd Floor')
    ON CONFLICT (building_id, code) DO UPDATE SET name = EXCLUDED.name;

    SELECT id INTO floor_a_g FROM floor_plans WHERE building_id = building_a_id AND code = 'G';
    SELECT id INTO floor_a_2 FROM floor_plans WHERE building_id = building_a_id AND code = '2';
    SELECT id INTO floor_a_3 FROM floor_plans WHERE building_id = building_a_id AND code = '3';
    SELECT id INTO floor_a_4 FROM floor_plans WHERE building_id = building_a_id AND code = '4';
    SELECT id INTO floor_b_g FROM floor_plans WHERE building_id = building_b_id AND code = 'G';
    SELECT id INTO floor_b_2 FROM floor_plans WHERE building_id = building_b_id AND code = '2';

    -- 5. Create Rooms - Building A Ground Floor
    INSERT INTO rooms (room_number, room_type_id, floor_plan_id, building_id, status)
    VALUES 
        ('101', std_type_id, floor_a_g, building_a_id, 'available'),
        ('102', std_type_id, floor_a_g, building_a_id, 'occupied'),
        ('103', dlx_type_id, floor_a_g, building_a_id, 'available'),
        ('104', dlx_type_id, floor_a_g, building_a_id, 'dirty'),
        ('105', sui_type_id, floor_a_g, building_a_id, 'available')
    ON CONFLICT (room_number) DO UPDATE SET status = EXCLUDED.status;

    -- Building A 2nd Floor
    INSERT INTO rooms (room_number, room_type_id, floor_plan_id, building_id, status)
    VALUES 
        ('201', std_type_id, floor_a_2, building_a_id, 'available'),
        ('202', std_type_id, floor_a_2, building_a_id, 'occupied'),
        ('203', dlx_type_id, floor_a_2, building_a_id, 'occupied'),
        ('204', dlx_type_id, floor_a_2, building_a_id, 'available'),
        ('205', fam_type_id, floor_a_2, building_a_id, 'available')
    ON CONFLICT (room_number) DO UPDATE SET status = EXCLUDED.status;

    -- Building A 3rd Floor
    INSERT INTO rooms (room_number, room_type_id, floor_plan_id, building_id, status)
    VALUES 
        ('301', std_type_id, floor_a_3, building_a_id, 'clean'),
        ('302', std_type_id, floor_a_3, building_a_id, 'available'),
        ('303', dlx_type_id, floor_a_3, building_a_id, 'occupied'),
        ('304', sui_type_id, floor_a_3, building_a_id, 'available')
    ON CONFLICT (room_number) DO UPDATE SET status = EXCLUDED.status;

    -- Building A 4th Floor
    INSERT INTO rooms (room_number, room_type_id, floor_plan_id, building_id, status)
    VALUES 
        ('401', dlx_type_id, floor_a_4, building_a_id, 'available'),
        ('402', dlx_type_id, floor_a_4, building_a_id, 'occupied'),
        ('403', sui_type_id, floor_a_4, building_a_id, 'maintenance'),
        ('404', sui_type_id, floor_a_4, building_a_id, 'available')
    ON CONFLICT (room_number) DO UPDATE SET status = EXCLUDED.status;

    -- Building B Ground Floor
    INSERT INTO rooms (room_number, room_type_id, floor_plan_id, building_id, status)
    VALUES 
        ('G01', std_type_id, floor_b_g, building_b_id, 'available'),
        ('G02', std_type_id, floor_b_g, building_b_id, 'available'),
        ('G03', fam_type_id, floor_b_g, building_b_id, 'occupied')
    ON CONFLICT (room_number) DO UPDATE SET status = EXCLUDED.status;

    -- Building B 2nd Floor
    INSERT INTO rooms (room_number, room_type_id, floor_plan_id, building_id, status)
    VALUES 
        ('B201', std_type_id, floor_b_2, building_b_id, 'available'),
        ('B202', dlx_type_id, floor_b_2, building_b_id, 'available'),
        ('B203', fam_type_id, floor_b_2, building_b_id, 'dirty')
    ON CONFLICT (room_number) DO UPDATE SET status = EXCLUDED.status;

    RAISE NOTICE '✅ Sample room data created successfully!';
END $$;

-- Verify results
SELECT 
    b.name as building,
    f.name as floor,
    COUNT(*) as room_count,
    string_agg(DISTINCT r.status, ', ') as statuses
FROM rooms r
JOIN floor_plans f ON r.floor_plan_id = f.id
JOIN buildings b ON r.building_id = b.id
GROUP BY b.name, f.name
ORDER BY b.name, f.name;
