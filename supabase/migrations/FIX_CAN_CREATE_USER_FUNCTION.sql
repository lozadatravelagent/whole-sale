-- Fix can_create_user_with_role to work properly from Edge Functions
-- The issue is that when called from Edge Function, the function reads from users table
-- which is subject to RLS, causing it to not find the user

-- Drop and recreate with proper security context (CASCADE to drop dependent policies)
DROP FUNCTION IF EXISTS public.can_create_user_with_role(public.user_role) CASCADE;

CREATE OR REPLACE FUNCTION public.can_create_user_with_role(target_role public.user_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role public.user_role;
BEGIN
  -- Get current user's role directly from users table
  -- SECURITY DEFINER allows this to bypass RLS
  SELECT role INTO current_user_role
  FROM public.users
  WHERE id = auth.uid();

  -- If user not found, return false
  IF current_user_role IS NULL THEN
    RAISE NOTICE 'User not found: %', auth.uid();
    RETURN false;
  END IF;

  RAISE NOTICE 'Current user role: %, Target role: %', current_user_role, target_role;

  -- OWNER can create any role
  IF current_user_role = 'OWNER' THEN
    RETURN true;
  END IF;

  -- SUPERADMIN can create SUPERADMIN, ADMIN, SELLER (not OWNER)
  IF current_user_role = 'SUPERADMIN' AND target_role IN ('SUPERADMIN', 'ADMIN', 'SELLER') THEN
    RETURN true;
  END IF;

  -- ADMIN can only create SELLER
  IF current_user_role = 'ADMIN' AND target_role = 'SELLER' THEN
    RETURN true;
  END IF;

  -- Default: cannot create
  RETURN false;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.can_create_user_with_role(public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_user_with_role(public.user_role) TO service_role;

COMMENT ON FUNCTION public.can_create_user_with_role(public.user_role) IS
'Checks if authenticated user has permission to create a user with the target role. Uses SECURITY DEFINER to bypass RLS.';

-- Recreate the policy that depends on this function
-- (it was dropped by CASCADE)
CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    -- OWNER can create in any tenant/agency
    public.is_owner()
    OR (
      -- SUPERADMIN can create in their tenant
      public.get_user_role() = 'SUPERADMIN'
      AND tenant_id = public.get_user_tenant_id()
    )
    OR (
      -- ADMIN can create SELLERS in their agency
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);

-- Test the function
SELECT 'Function updated successfully!' as status;
