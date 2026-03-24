-- Add allotment_code to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS allotment_code TEXT REFERENCES public.corporate_allotments(allot_code) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reservations_allotment_code ON public.reservations(allotment_code);
