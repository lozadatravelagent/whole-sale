-- FIX: Remove infinite recursion in users table RLS policies
-- The problem: policies that SELECT from users table to check role create infinite loops

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "users can read own data" ON public.users;
DROP POLICY IF EXISTS "owner can read all users" ON public.users;
DROP POLICY IF EXISTS "owner_full_access" ON public.users;
DROP POLICY IF EXISTS "superadmin can read tenant users" ON public.users;
DROP POLICY IF EXISTS "admin can read agency users" ON public.users;

-- Simple policy: Users can always read their own record (no recursion)
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

-- OWNER can read all users using helper function (no recursion because helper uses auth.jwt())
CREATE POLICY "owner_select_all_users"
  ON public.users FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) = 'OWNER'
  );

-- SUPERADMIN can read users in their tenant
CREATE POLICY "superadmin_select_tenant_users"
  ON public.users FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) = 'SUPERADMIN'
    AND tenant_id = (SELECT get_user_tenant_id())
  );

-- ADMIN can read users in their agency
CREATE POLICY "admin_select_agency_users"
  ON public.users FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) = 'ADMIN'
    AND agency_id = (SELECT get_user_agency_id())
  );

-- SELLER can only read their own record (covered by users_select_own)
