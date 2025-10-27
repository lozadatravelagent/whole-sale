-- Fix: ADMIN should see all users from their agency (not just SELLERS)
-- Date: 2025-10-06

-- Drop existing policy
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

-- Recreate policy with fix for ADMIN role
CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid() -- Can see self
  OR public.is_owner() -- OWNER sees all
  OR (
    -- SUPERADMIN sees users in their assigned agencies
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = ANY(public.get_superadmin_agency_ids())
  )
  OR (
    -- ADMIN sees ALL users in their agency (not just SELLERS)
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
  )
);

-- Success message
SELECT 'ADMIN users visibility fixed - can now see all users in their agency' as status;
