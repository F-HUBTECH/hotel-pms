-- =============================================
-- Phase 6: Operational Row Level Security (RLS)
-- Multi-Property Data Isolation
-- =============================================

-- 1. Add property_id to Profiles for explicit tenant mapping if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='property_id') THEN
        ALTER TABLE public.profiles ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;
        
        -- Fallback: Assign all existing profiles to the default MAIN property
        UPDATE public.profiles SET property_id = (SELECT id FROM public.properties WHERE code = 'MAIN' LIMIT 1) WHERE property_id IS NULL;
    END IF;
END $$;

-- 2. Helper function to fetch the current user's property_id context
CREATE OR REPLACE FUNCTION public.get_user_property_id()
RETURNS UUID AS $$
  SELECT property_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Apply Multi-Tenant RLS to Core Operational Tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'reservations', 'folios', 'folio_transactions', 'payments',
      'account_postings', 'night_audits', 'housekeeping_tasks', 
      'channel_reservations', 'room_inventory'
    ])
  LOOP
    -- Enable RLS natively
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- SELECT: users can view records belonging strictly to their assigned property (Super Admins can view all)
    EXECUTE format('
      CREATE POLICY "Users can view %I in their property"
        ON public.%I FOR SELECT
        TO authenticated
        USING (property_id = public.get_user_property_id() OR public.is_admin_or_above());
    ', t, t);

    -- INSERT: users can insert into their property records
    EXECUTE format('
      CREATE POLICY "Users can create %I in their property"
        ON public.%I FOR INSERT
        TO authenticated
        WITH CHECK (property_id = public.get_user_property_id() OR public.is_admin_or_above());
    ', t, t);

    -- UPDATE: users can update their property records
    EXECUTE format('
      CREATE POLICY "Users can update %I in their property"
        ON public.%I FOR UPDATE
        TO authenticated
        USING (property_id = public.get_user_property_id() OR public.is_admin_or_above());
    ', t, t);

    -- DELETE: Admins only can delete operational data
    EXECUTE format('
      CREATE POLICY "Admins can delete %I"
        ON public.%I FOR DELETE
        TO authenticated
        USING (public.is_admin_or_above());
    ', t, t);
  END LOOP;
END;
$$;
