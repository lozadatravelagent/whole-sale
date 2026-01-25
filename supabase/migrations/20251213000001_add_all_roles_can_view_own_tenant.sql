-- =====================================================
-- Migration: Allow all authenticated users to view their own tenant
-- Description: Fix 406 errors for SELLER/ADMIN/OWNER roles when querying tenants table
-- Date: 2025-12-13
-- Issue: Users with SELLER, ADMIN, OWNER roles get 406 (Not Acceptable) when trying to view tenant info
-- Solution: Add RLS policy that allows any authenticated user to SELECT their own tenant
-- =====================================================

-- Drop existing policy if it exists (to ensure idempotency)
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;

-- Create new policy allowing all authenticated users to view their own tenant
-- Uses the existing is_same_tenant() helper function that checks:
--   SELECT EXISTS (
--     SELECT 1 FROM public.users u
--     WHERE u.id = auth.uid() AND u.tenant_id = _tenant_id
--   )
CREATE POLICY "Users can view their own tenant"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (public.is_same_tenant(id));

-- Add comment for documentation
COMMENT ON POLICY "Users can view their own tenant" ON public.tenants IS
  'Allows all authenticated users (SELLER, ADMIN, SUPERADMIN, OWNER) to SELECT their own tenant.
   This policy works in conjunction with existing SUPERADMIN policies.';

-- Verification query (commented out - uncomment to test after migration)
-- SELECT id, name, created_at FROM public.tenants LIMIT 1;

-- Note: This policy allows SELECT only. Insert/Update/Delete are still restricted to SUPERADMIN
-- via existing policies like "superadmins can insert tenants", "superadmins can update tenants", etc.
