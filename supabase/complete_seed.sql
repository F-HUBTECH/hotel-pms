-- ============================================
-- COMPLETE SEED SCRIPT with Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- STEP 1: Add missing columns
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Bangkok',
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Thailand',
ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Bangkok',
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'THB';

ALTER TABLE room_types 
ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 2;

-- Add code column to buildings if not exists
ALTER TABLE buildings 
ADD COLUMN IF NOT EXISTS code TEXT;

-- Add unique constraint for buildings (property_id, code)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'buildings_property_code_unique'
    ) THEN
        ALTER TABLE buildings ADD CONSTRAINT buildings_property_code_unique UNIQUE (property_id, code);
    END IF;
END $$;

-- STEP 2: Create Property
INSERT INTO properties (code, name, address, city, country, phone, email, timezone, currency)
VALUES ('MAIN', 'Main Hotel', '123 Hotel Street', 'Bangkok', 'Thailand', '+66 2 123 4567', 'info@hotel.com', 'Asia/Bangkok', 'THB')
ON CONFLICT (code) DO NOTHING;

-- STEP 3: Create Buildings, Room Types, Floors, Rooms
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

    -- Buildings
    INSERT INTO buildings (property_id, code, name, description)
    VALUES 
        (prop_id, 'A', 'Building A - Main Tower', 'Main hotel tower with sea view'),
        (prop_id, 'B', 'Building B - Garden Wing', 'Garden wing with pool access')
    ON CONFLICT (property_id, code) DO UPDATE SET name = EXCLUDED.name;
    
    SELECT id INTO building_a_id FROM buildings WHERE code = 'A' AND property_id = prop_id;
    SELECT id INTO building_b_id FROM buildings WHERE code = 'B' AND property_id = prop_id;

    -- Room Types
    INSERT INTO room_types (code, name, description, base_price)
    VALUES 
        ('STD', 'Standard Room', 'Comfortable standard room', 1500),
        ('DLX', 'Deluxe Room', 'Spacious deluxe room with balcony', 2500),
        ('SUI', 'Suite', 'Luxury suite with living room', 4500),
        ('FAM', 'Family Room', 'Large room for families', 3500)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

    SELECT id INTO std_type_id FROM room_types WHERE code = 'STD';
    SELECT id INTO dlx_type_id FROM room_types WHERE code = 'DLX';
    SELECT id INTO sui_type_id FROM room_types WHERE code = 'SUI';
    SELECT id INTO fam_type_id FROM room_types WHERE code = 'FAM';

    -- Floors
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

    -- Rooms
    INSERT INTO rooms (room_number, room_type_id, floor_plan_id, building_id, status) VALUES
        ('101', std_type_id, floor_a_g, building_a_id, 'available'),
        ('102', std_type_id, floor_a_g, building_a_id, 'occupied'),
        ('103', dlx_type_id, floor_a_g, building_a_id, 'available'),
        ('104', dlx_type_id, floor_a_g, building_a_id, 'dirty'),
        ('105', sui_type_id, floor_a_g, building_a_id, 'available'),
        ('201', std_type_id, floor_a_2, building_a_id, 'available'),
        ('202', std_type_id, floor_a_2, building_a_id, 'occupied'),
        ('203', dlx_type_id, floor_a_2, building_a_id, 'occupied'),
        ('204', dlx_type_id, floor_a_2, building_a_id, 'available'),
        ('205', fam_type_id, floor_a_2, building_a_id, 'available'),
        ('301', std_type_id, floor_a_3, building_a_id, 'clean'),
        ('302', std_type_id, floor_a_3, building_a_id, 'available'),
        ('303', dlx_type_id, floor_a_3, building_a_id, 'occupied'),
        ('304', sui_type_id, floor_a_3, building_a_id, 'available'),
        ('401', dlx_type_id, floor_a_4, building_a_id, 'available'),
        ('402', dlx_type_id, floor_a_4, building_a_id, 'occupied'),
        ('403', sui_type_id, floor_a_4, building_a_id, 'maintenance'),
        ('404', sui_type_id, floor_a_4, building_a_id, 'available'),
        ('G01', std_type_id, floor_b_g, building_b_id, 'available'),
        ('G02', std_type_id, floor_b_g, building_b_id, 'available'),
        ('G03', fam_type_id, floor_b_g, building_b_id, 'occupied'),
        ('B201', std_type_id, floor_b_2, building_b_id, 'available'),
        ('B202', dlx_type_id, floor_b_2, building_b_id, 'available'),
        ('B203', fam_type_id, floor_b_2, building_b_id, 'dirty')
    ON CONFLICT (room_number) DO UPDATE SET status = EXCLUDED.status;

    RAISE NOTICE '✅ Created 22 sample rooms successfully!';
END $$;

-- Verify
SELECT b.name as building, f.name as floor, COUNT(*) as rooms,
       string_agg(DISTINCT r.status, ', ') as statuses
FROM rooms r
JOIN floor_plans f ON r.floor_plan_id = f.id
JOIN buildings b ON r.building_id = b.id
GROUP BY b.name, f.name
ORDER BY b.name, f.name;
