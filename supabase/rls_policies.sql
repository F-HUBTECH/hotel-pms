-- =============================================
-- Hotel PMS - Row Level Security Policies
-- Run this in Supabase SQL Editor AFTER schema.sql
-- =============================================

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is admin+
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- PROFILES
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_above());

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_above());

-- =============================================
-- MACRO: Apply standard RLS to master data tables
-- All authenticated users can read, admins can write
-- =============================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'buildings', 'floor_plans', 'room_types', 'rooms',
      'rate_groups', 'rate_formulas', 'market_groups', 'markets',
      'guest_types', 'nationalities', 'passport_types', 'visa_types',
      'booking_sources', 'channels', 'departments', 'user_groups',
      'special_services', 'folio_groups', 'zone_codes'
    ])
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- SELECT: all authenticated users
    EXECUTE format('
      CREATE POLICY "Authenticated users can view %I"
        ON public.%I FOR SELECT
        TO authenticated
        USING (true);
    ', t, t);

    -- INSERT: admins only
    EXECUTE format('
      CREATE POLICY "Admins can create %I"
        ON public.%I FOR INSERT
        TO authenticated
        WITH CHECK (public.is_admin_or_above());
    ', t, t);

    -- UPDATE: admins only
    EXECUTE format('
      CREATE POLICY "Admins can update %I"
        ON public.%I FOR UPDATE
        TO authenticated
        USING (public.is_admin_or_above());
    ', t, t);

    -- DELETE: admins only
    EXECUTE format('
      CREATE POLICY "Admins can delete %I"
        ON public.%I FOR DELETE
        TO authenticated
        USING (public.is_admin_or_above());
    ', t, t);
  END LOOP;
END;
$$;
