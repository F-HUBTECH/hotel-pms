-- Seed default user rights for admin
-- Run this after creating users to give admin all rights

DO $$
DECLARE
  admin_user_id UUID;
  right_id UUID;
BEGIN
  -- Find admin user (super_admin or admin)
  SELECT id INTO admin_user_id 
  FROM public.profiles 
  WHERE role IN ('admin', 'super_admin') 
  LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- Grant all rights to admin
    INSERT INTO public.user_rights (user_id, function_code, can_view, can_create, can_edit, can_delete, can_print)
    VALUES 
      (admin_user_id, 'KO39', true, true, true, true, true),  -- Payment
      (admin_user_id, 'KO40', true, true, true, true, true),  -- Void
      (admin_user_id, 'KO41', true, true, true, true, true),  -- Post Charge
      (admin_user_id, 'KO42', true, true, true, true, true),  -- Transfer
      (admin_user_id, 'KO43', true, true, true, true, true),  -- Folio Setup
      (admin_user_id, 'KO44', true, true, true, true, true),  -- Checkout
      (admin_user_id, 'KO45', true, true, true, true, true),  -- Credit Note
      (admin_user_id, 'KO46', true, true, true, true, true),  -- Correction
      (admin_user_id, 'KO47', true, true, true, true, true),  -- Split
      (admin_user_id, 'KO48', true, true, true, true, true),  -- Tax Invoice
      (admin_user_id, 'KO50', true, true, true, true, true),  -- Fast Posting
      (admin_user_id, 'KO51', true, true, true, true, true),  -- Dummy Room
      (admin_user_id, 'KO52', true, true, true, true, true)   -- Advance Payment
    ON CONFLICT (user_id, function_code) DO UPDATE SET
      can_view = true, can_create = true, can_edit = true, can_delete = true, can_print = true,
      updated_at = NOW();
    
    RAISE NOTICE 'Admin rights seeded successfully for user: %', admin_user_id;
  ELSE
    RAISE NOTICE 'No admin user found';
  END IF;
END $$;
