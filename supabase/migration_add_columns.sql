-- Migration: Add missing columns to properties table
-- Run this in Supabase Dashboard → SQL Editor

-- Add all missing columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Bangkok',
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Thailand',
ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Bangkok',
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'THB';

-- Also add max_occupancy to room_types if needed
ALTER TABLE room_types 
ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 2;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'properties' 
ORDER BY ordinal_position;
