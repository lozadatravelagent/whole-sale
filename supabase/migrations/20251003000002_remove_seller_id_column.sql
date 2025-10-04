-- Migration: Remove seller_id column from leads table
-- Now we use assigned_user_id which points to users table with role='SELLER'

-- 1. Migrate existing data from seller_id to assigned_user_id if needed
-- (Only if there's data in seller_id that's not in assigned_user_id)
UPDATE public.leads
SET assigned_user_id = seller_id
WHERE assigned_user_id IS NULL AND seller_id IS NOT NULL;

-- 2. Drop the seller_id column (it's deprecated)
ALTER TABLE public.leads
DROP COLUMN IF EXISTS seller_id;

-- 3. Add comment to assigned_user_id for documentation
COMMENT ON COLUMN public.leads.assigned_user_id IS 'User ID of assigned seller (from users table with role=SELLER)';
