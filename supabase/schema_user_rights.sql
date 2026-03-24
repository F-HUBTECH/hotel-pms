-- User Rights System
-- ระบบสิทธิ์การใช้งานตาม Function Code (เช่น KO39 = Payment)

CREATE TABLE IF NOT EXISTS public.user_rights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    function_code TEXT NOT NULL,
    can_view BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_print BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, function_code)
);

ALTER TABLE public.user_rights ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own rights, admins can manage all
CREATE POLICY "Users can view own rights" ON public.user_rights
    FOR SELECT USING (
        auth.uid() = user_id 
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage all rights" ON public.user_rights
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_rights_user ON public.user_rights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rights_function ON public.user_rights(function_code);

-- Function to check if user has specific right
CREATE OR REPLACE FUNCTION public.check_user_right(
    p_user_id UUID,
    p_function_code TEXT,
    p_right_type TEXT DEFAULT 'can_view'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_right BOOLEAN;
BEGIN
    -- Admin always has all rights
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin') THEN
        RETURN TRUE;
    END IF;
    
    SELECT value INTO v_has_right
    FROM public.user_rights
    WHERE user_id = p_user_id AND function_code = p_function_code;
    
    RETURN COALESCE(v_has_right, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant right to user
CREATE OR REPLACE FUNCTION public.grant_user_right(
    p_user_id UUID,
    p_function_code TEXT,
    p_can_view BOOLEAN DEFAULT false,
    p_can_create BOOLEAN DEFAULT false,
    p_can_edit BOOLEAN DEFAULT false,
    p_can_delete BOOLEAN DEFAULT false,
    p_can_print BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_right_id UUID;
BEGIN
    INSERT INTO public.user_rights (
        user_id, function_code, can_view, can_create, can_edit, can_delete, can_print
    ) VALUES (
        p_user_id, p_function_code, p_can_view, p_can_create, p_can_edit, p_can_delete, p_can_print
    )
    ON CONFLICT (user_id, function_code) 
    DO UPDATE SET
        can_view = EXCLUDED.can_view,
        can_create = EXCLUDED.can_create,
        can_edit = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete,
        can_print = EXCLUDED.can_print,
        updated_at = NOW()
    RETURNING id INTO v_right_id;
    
    RETURN v_right_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Default function codes for Hotel PMS (based on KFO)
-- KO39 = Payment
-- KO40 = Void
-- KO41 = Post Charge
-- KO42 = Transfer
-- KO43 = Folio Setup
-- KO44 = Checkout
-- KO45 = Credit Note
-- KO46 = Post Correction
-- KO47 = Split Transaction
-- KO48 = Tax Invoice
