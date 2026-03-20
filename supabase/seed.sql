-- =============================================
-- Hotel PMS - Seed Data for Development
-- Run this in Supabase SQL Editor AFTER schema.sql and rls_policies.sql
-- =============================================

-- Buildings
INSERT INTO public.buildings (name, description) VALUES
  ('Main Building', 'Primary hotel building with lobby and main reception'),
  ('East Wing', 'Eastern wing with ocean view rooms'),
  ('West Wing', 'Western wing with garden view rooms'),
  ('Villa Complex', 'Premium standalone villas')
ON CONFLICT DO NOTHING;

-- Room Types
INSERT INTO public.room_types (code, name, description, base_price) VALUES
  ('STD', 'Standard', 'Standard room with basic amenities', 1500.00),
  ('SUP', 'Superior', 'Superior room with upgraded amenities', 2500.00),
  ('DLX', 'Deluxe', 'Deluxe room with premium furnishing', 3500.00),
  ('SUI', 'Suite', 'Luxury suite with separate living area', 5500.00),
  ('PRS', 'Presidential Suite', 'Top-tier presidential suite', 12000.00),
  ('FAM', 'Family Room', 'Spacious room for families with connecting doors', 4000.00)
ON CONFLICT (code) DO NOTHING;

-- Floor Plans (linked to buildings)
INSERT INTO public.floor_plans (building_id, name)
SELECT b.id, f.name
FROM public.buildings b
CROSS JOIN (
  VALUES ('Floor 1'), ('Floor 2'), ('Floor 3'), ('Floor 4'), ('Floor 5')
) AS f(name)
WHERE b.name = 'Main Building';

INSERT INTO public.floor_plans (building_id, name)
SELECT b.id, f.name
FROM public.buildings b
CROSS JOIN (
  VALUES ('Floor 1'), ('Floor 2'), ('Floor 3')
) AS f(name)
WHERE b.name = 'East Wing';

-- Rooms (sample set) - FIXED: More rooms with available/clean status
INSERT INTO public.rooms (room_number, building_id, floor_plan_id, room_type_id, status)
SELECT
  format('%s%02s', fp.name, gs.n),
  b.id,
  fp.id,
  rt.id,
  CASE 
    WHEN gs.n % 10 = 0 THEN 'maintenance' 
    WHEN gs.n % 7 = 0 THEN 'occupied' 
    WHEN gs.n % 3 = 0 THEN 'clean'
    ELSE 'available' 
  END
FROM public.buildings b
JOIN public.floor_plans fp ON fp.building_id = b.id
CROSS JOIN generate_series(1, 20) AS gs(n)
CROSS JOIN (SELECT id FROM public.room_types LIMIT 6) AS rt
WHERE b.name = 'Main Building'
ON CONFLICT DO NOTHING;

-- Properties (for multi-property support)
INSERT INTO public.properties (name, code, address, timezone) VALUES
  ('Main Hotel', 'MAIN', '123 Main Street, Bangkok, Thailand', 'Asia/Bangkok'),
  ('Beach Resort', 'BEACH', '456 Beach Road, Phuket, Thailand', 'Asia/Bangkok')
ON CONFLICT DO NOTHING;

-- Rate Plans (active rate plans for booking)
INSERT INTO public.rate_plans (property_id, name, room_type_id, base_price, refundable, is_active)
SELECT 
  p.id,
  rt.name || ' - Standard Rate',
  rt.id,
  rt.base_price,
  true,
  true
FROM public.properties p
CROSS JOIN public.room_types rt
WHERE p.code = 'MAIN'
ON CONFLICT DO NOTHING;

-- Room Inventory (required for booking)
INSERT INTO public.room_inventory (property_id, room_type_id, inventory_date, total_rooms, available_rooms, reserved_rooms)
SELECT 
  p.id,
  rt.id,
  d.date,
  10,
  10,
  0
FROM public.properties p
CROSS JOIN public.room_types rt
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', INTERVAL '1 day') AS d(date)
WHERE p.code = 'MAIN'
ON CONFLICT DO NOTHING;

-- Rate Groups
INSERT INTO public.rate_groups (code, name) VALUES
  ('RAK', 'Rack Rate'),
  ('CRP', 'Corporate Rate'),
  ('GOV', 'Government Rate'),
  ('WHL', 'Wholesale Rate'),
  ('PKG', 'Package Rate'),
  ('PRO', 'Promotional Rate')
ON CONFLICT (code) DO NOTHING;

-- Rate Formulas
INSERT INTO public.rate_formulas (rate_group_id, calculation_type, value, description)
SELECT rg.id, v.calc_type, v.val, v.description
FROM public.rate_groups rg
CROSS JOIN (VALUES
  ('fixed', 0, 'Standard fixed rate'),
  ('percentage', 10, '10% discount from rack rate')
) AS v(calc_type, val, description)
WHERE rg.code = 'CRP'
ON CONFLICT DO NOTHING;

-- Market Groups
INSERT INTO public.market_groups (name) VALUES
  ('Leisure'), ('Corporate'), ('Government'), ('Group'), ('Online Travel Agent')
ON CONFLICT DO NOTHING;

-- Markets
INSERT INTO public.markets (market_group_id, name)
SELECT mg.id, m.name
FROM public.market_groups mg
CROSS JOIN (VALUES ('Domestic'), ('International')) AS m(name)
WHERE mg.name = 'Leisure'
ON CONFLICT DO NOTHING;

INSERT INTO public.markets (market_group_id, name)
SELECT mg.id, m.name
FROM public.market_groups mg
CROSS JOIN (VALUES ('Local Corporate'), ('Multinational')) AS m(name)
WHERE mg.name = 'Corporate'
ON CONFLICT DO NOTHING;

-- Guest Types
INSERT INTO public.guest_types (name) VALUES
  ('Individual'), ('Corporate'), ('VIP'), ('Group Member'),
  ('Walk-in'), ('Government'), ('Airline Crew')
ON CONFLICT DO NOTHING;

-- Nationalities
INSERT INTO public.nationalities (name, country_code) VALUES
  ('Thai', 'TH'), ('American', 'US'), ('British', 'GB'),
  ('Japanese', 'JP'), ('Chinese', 'CN'), ('Korean', 'KR'),
  ('Australian', 'AU'), ('German', 'DE'), ('French', 'FR'),
  ('Indian', 'IN'), ('Russian', 'RU'), ('Singaporean', 'SG')
ON CONFLICT DO NOTHING;

-- Passport Types
INSERT INTO public.passport_types (name) VALUES
  ('Regular'), ('Diplomatic'), ('Official'), ('Emergency'), ('Collective')
ON CONFLICT DO NOTHING;

-- Visa Types
INSERT INTO public.visa_types (name) VALUES
  ('Tourist'), ('Business'), ('Transit'), ('Student'),
  ('Work Permit'), ('Diplomatic'), ('No Visa Required')
ON CONFLICT DO NOTHING;

-- Booking Sources
INSERT INTO public.booking_sources (name) VALUES
  ('Direct'), ('Phone'), ('Email'), ('Website'),
  ('Walk-in'), ('Travel Agent'), ('OTA'), ('GDS')
ON CONFLICT DO NOTHING;

-- Channels
INSERT INTO public.channels (name) VALUES
  ('Direct Booking'), ('Booking.com'), ('Agoda'), ('Expedia'),
  ('Hotels.com'), ('Airbnb'), ('Trip.com'), ('Traveloka')
ON CONFLICT DO NOTHING;

-- Departments
INSERT INTO public.departments (name) VALUES
  ('Front Office'), ('Housekeeping'), ('Food & Beverage'),
  ('Engineering'), ('Accounting'), ('Sales & Marketing'),
  ('Human Resources'), ('Security'), ('IT')
ON CONFLICT DO NOTHING;

-- User Groups
INSERT INTO public.user_groups (name) VALUES
  ('Front Desk'), ('Night Audit'), ('Reservations'),
  ('Management'), ('Housekeeping'), ('Finance')
ON CONFLICT DO NOTHING;

-- Special Services
INSERT INTO public.special_services (name, price) VALUES
  ('Airport Transfer', 1500.00),
  ('Late Check-out', 800.00),
  ('Early Check-in', 800.00),
  ('Extra Bed', 500.00),
  ('Baby Cot', 300.00),
  ('Laundry Express', 200.00),
  ('Mini Bar Refill', 350.00),
  ('Room Upgrade', 1000.00)
ON CONFLICT DO NOTHING;

-- Folio Groups
INSERT INTO public.folio_groups (name) VALUES
  ('Room Charges'), ('Food & Beverage'), ('Minibar'),
  ('Telephone'), ('Laundry'), ('Other Services'),
  ('Taxes'), ('Payments')
ON CONFLICT DO NOTHING;

-- Zone Codes
INSERT INTO public.zone_codes (code, description) VALUES
  ('LOBBY', 'Main lobby area'),
  ('POOL', 'Swimming pool area'),
  ('REST', 'Restaurant area'),
  ('SPA', 'Spa and wellness'),
  ('GYM', 'Fitness center'),
  ('PARK', 'Parking area'),
  ('CONF', 'Conference rooms'),
  ('BUSI', 'Business center')
ON CONFLICT DO NOTHING;
