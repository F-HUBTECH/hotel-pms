-- ============================================
-- COMPLETE SEED - All-in-one SQL
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- STEP 1: Add ALL missing columns first
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Bangkok',
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'THB',
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Bangkok',
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Thailand';

ALTER TABLE room_types 
ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 2;

ALTER TABLE buildings 
ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE floor_plans 
ADD COLUMN IF NOT EXISTS code TEXT;

-- STEP 2: Create Property
INSERT INTO properties (code, name, address, timezone, currency)
VALUES ('MAIN', 'Main Hotel', '123 Hotel Street', 'Asia/Bangkok', 'THB')
ON CONFLICT (code) DO NOTHING;

-- STEP 3: Create Buildings, Room Types, Floors, Rooms
DO $$
DECLARE
    prop_id UUID;
    building_a_id UUID;
    building_b_id UUID;
    std_id UUID; dlx_id UUID; sui_id UUID; fam_id UUID;
    f_a_g UUID; f_a_2 UUID; f_a_3 UUID; f_a_4 UUID;
    f_b_g UUID; f_b_2 UUID;
BEGIN
    SELECT id INTO prop_id FROM properties WHERE code = 'MAIN' LIMIT 1;

    -- Buildings
    INSERT INTO buildings (property_id, code, name, description) VALUES
        (prop_id, 'A', 'Building A - Main Tower', 'Main hotel tower with sea view'),
        (prop_id, 'B', 'Building B - Garden Wing', 'Garden wing with pool access')
    ON CONFLICT DO NOTHING;
    
    SELECT id INTO building_a_id FROM buildings WHERE code = 'A' AND property_id = prop_id;
    SELECT id INTO building_b_id FROM buildings WHERE code = 'B' AND property_id = prop_id;

    -- Room Types
    INSERT INTO room_types (code, name, description, base_price) VALUES
        ('STD', 'Standard Room', 'Comfortable standard room', 1500),
        ('DLX', 'Deluxe Room', 'Spacious deluxe room with balcony', 2500),
        ('SUI', 'Suite', 'Luxury suite with living room', 4500),
        ('FAM', 'Family Room', 'Large room for families', 3500)
    ON CONFLICT (code) DO NOTHING;
    
    SELECT id INTO std_id FROM room_types WHERE code = 'STD';
    SELECT id INTO dlx_id FROM room_types WHERE code = 'DLX';
    SELECT id INTO sui_id FROM room_types WHERE code = 'SUI';
    SELECT id INTO fam_id FROM room_types WHERE code = 'FAM';

    -- Floors
    INSERT INTO floor_plans (building_id, code, name) VALUES
        (building_a_id, 'G', 'Ground Floor'),
        (building_a_id, '2', '2nd Floor'),
        (building_a_id, '3', '3rd Floor'),
        (building_a_id, '4', '4th Floor'),
        (building_b_id, 'G', 'Ground Floor'),
        (building_b_id, '2', '2nd Floor')
    ON CONFLICT DO NOTHING;
    
    SELECT id INTO f_a_g FROM floor_plans WHERE building_id = building_a_id AND code = 'G';
    SELECT id INTO f_a_2 FROM floor_plans WHERE building_id = building_a_id AND code = '2';
    SELECT id INTO f_a_3 FROM floor_plans WHERE building_id = building_a_id AND code = '3';
    SELECT id INTO f_a_4 FROM floor_plans WHERE building_id = building_a_id AND code = '4';
    SELECT id INTO f_b_g FROM floor_plans WHERE building_id = building_b_id AND code = 'G';
    SELECT id INTO f_b_2 FROM floor_plans WHERE building_id = building_b_id AND code = '2';

    -- 22 Rooms
    INSERT INTO rooms (room_number, room_type_id, floor_plan_id, building_id, status) VALUES
        ('101', std_id, f_a_g, building_a_id, 'available'),
        ('102', std_id, f_a_g, building_a_id, 'occupied'),
        ('103', dlx_id, f_a_g, building_a_id, 'available'),
        ('104', dlx_id, f_a_g, building_a_id, 'dirty'),
        ('105', sui_id, f_a_g, building_a_id, 'available'),
        ('201', std_id, f_a_2, building_a_id, 'available'),
        ('202', std_id, f_a_2, building_a_id, 'occupied'),
        ('203', dlx_id, f_a_2, building_a_id, 'occupied'),
        ('204', dlx_id, f_a_2, building_a_id, 'available'),
        ('205', fam_id, f_a_2, building_a_id, 'available'),
        ('301', std_id, f_a_3, building_a_id, 'clean'),
        ('302', std_id, f_a_3, building_a_id, 'available'),
        ('303', dlx_id, f_a_3, building_a_id, 'occupied'),
        ('304', sui_id, f_a_3, building_a_id, 'available'),
        ('401', dlx_id, f_a_4, building_a_id, 'available'),
        ('402', dlx_id, f_a_4, building_a_id, 'occupied'),
        ('403', sui_id, f_a_4, building_a_id, 'maintenance'),
        ('404', sui_id, f_a_4, building_a_id, 'available'),
        ('G01', std_id, f_b_g, building_b_id, 'available'),
        ('G02', std_id, f_b_g, building_b_id, 'available'),
        ('G03', fam_id, f_b_g, building_b_id, 'occupied'),
        ('B201', std_id, f_b_2, building_b_id, 'available'),
        ('B202', dlx_id, f_b_2, building_b_id, 'available'),
        ('B203', fam_id, f_b_2, building_b_id, 'dirty')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE '✅ Created 22 rooms successfully!';
END $$;

-- Verify
SELECT b.name as building, COUNT(*) as rooms,
       string_agg(DISTINCT r.status, ', ') as statuses
FROM rooms r
JOIN buildings b ON r.building_id = b.id
GROUP BY b.name;
