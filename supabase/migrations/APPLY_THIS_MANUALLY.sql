-- ============================================================================
-- CONSOLIDATED MIGRATION FOR USER & AGENCY MANAGEMENT
-- Apply this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- Step 1: Create helper functions (if they don't exist)
-- These read from JWT claims to avoid infinite recursion in RLS policies

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.jwt()->'app_metadata'->>'user_role';
$$;

CREATE OR REPLACE FUNCTION public.get_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt()->'app_metadata'->>'agency_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.jwt()->'app_metadata'->>'user_role' = 'OWNER';
$$;

-- ============================================================================
-- Step 2: Create user management validation functions
-- ============================================================================

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
  SELECT role INTO current_user_role
  FROM public.users
  WHERE id = auth.uid();

  IF current_user_role = 'OWNER' THEN
    RETURN true;
  END IF;

  IF current_user_role = 'SUPERADMIN' AND target_role IN ('SUPERADMIN', 'ADMIN', 'SELLER') THEN
    RETURN true;
  END IF;

  IF current_user_role = 'ADMIN' AND target_role = 'SELLER' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role public.user_role;
  current_user_tenant_id uuid;
  current_user_agency_id uuid;
  target_user_tenant_id uuid;
  target_user_agency_id uuid;
  target_user_role public.user_role;
BEGIN
  SELECT role, tenant_id, agency_id INTO current_user_role, current_user_tenant_id, current_user_agency_id
  FROM public.users
  WHERE id = auth.uid();

  SELECT role, tenant_id, agency_id INTO target_user_role, target_user_tenant_id, target_user_agency_id
  FROM public.users
  WHERE id = target_user_id;

  IF current_user_role = 'OWNER' THEN
    RETURN true;
  END IF;

  IF current_user_role = 'SUPERADMIN' AND target_user_role != 'OWNER' THEN
    RETURN current_user_tenant_id = target_user_tenant_id;
  END IF;

  IF current_user_role = 'ADMIN' AND target_user_role = 'SELLER' THEN
    RETURN current_user_agency_id = target_user_agency_id;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_allowed_roles_for_creation()
RETURNS public.user_role[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role public.user_role;
BEGIN
  SELECT role INTO current_user_role
  FROM public.users
  WHERE id = auth.uid();

  CASE current_user_role
    WHEN 'OWNER' THEN
      RETURN ARRAY['OWNER', 'SUPERADMIN', 'ADMIN', 'SELLER']::public.user_role[];
    WHEN 'SUPERADMIN' THEN
      RETURN ARRAY['SUPERADMIN', 'ADMIN', 'SELLER']::public.user_role[];
    WHEN 'ADMIN' THEN
      RETURN ARRAY['SELLER']::public.user_role[];
    ELSE
      RETURN ARRAY[]::public.user_role[];
  END CASE;
END;
$$;

-- ============================================================================
-- Step 3: Create agency management validation functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_create_agency()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role public.user_role;
BEGIN
  SELECT role INTO current_user_role
  FROM public.users
  WHERE id = auth.uid();

  RETURN current_user_role IN ('OWNER', 'SUPERADMIN');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_agency(target_agency_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role public.user_role;
  current_user_tenant_id uuid;
  target_agency_tenant_id uuid;
BEGIN
  SELECT role, tenant_id INTO current_user_role, current_user_tenant_id
  FROM public.users
  WHERE id = auth.uid();

  SELECT tenant_id INTO target_agency_tenant_id
  FROM public.agencies
  WHERE id = target_agency_id;

  IF current_user_role = 'OWNER' THEN
    RETURN true;
  END IF;

  IF current_user_role = 'SUPERADMIN' THEN
    RETURN current_user_tenant_id = target_agency_tenant_id;
  END IF;

  RETURN false;
END;
$$;

-- ============================================================================
-- Step 4: Update RLS policies for users table
-- ============================================================================

DROP POLICY IF EXISTS "user can select self" ON public.users;
DROP POLICY IF EXISTS "user can update self" ON public.users;
DROP POLICY IF EXISTS "superadmins can select users in tenant" ON public.users;
DROP POLICY IF EXISTS "superadmins can insert users" ON public.users;
DROP POLICY IF EXISTS "superadmins can update users in tenant" ON public.users;
DROP POLICY IF EXISTS "superadmins can delete users in tenant" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_owner()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()
  )
  OR (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    public.is_owner()
    OR (
      public.get_user_role() = 'SUPERADMIN'
      AND tenant_id = public.get_user_tenant_id()
    )
    OR (
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);

CREATE POLICY "users_update_policy" ON public.users FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR public.can_manage_user(id)
)
WITH CHECK (
  id = auth.uid()
  OR public.can_manage_user(id)
);

CREATE POLICY "users_delete_policy" ON public.users FOR DELETE TO authenticated
USING (
  public.is_owner()
);

-- ============================================================================
-- Step 5: Update RLS policies for agencies table
-- ============================================================================

DROP POLICY IF EXISTS "owner can select all agencies" ON public.agencies;
DROP POLICY IF EXISTS "superadmins can select agencies in tenant" ON public.agencies;
DROP POLICY IF EXISTS "admins can select their agency" ON public.agencies;
DROP POLICY IF EXISTS "owner can manage all agencies" ON public.agencies;
DROP POLICY IF EXISTS "superadmins can manage agencies" ON public.agencies;
DROP POLICY IF EXISTS "agencies_select_policy" ON public.agencies;
DROP POLICY IF EXISTS "agencies_insert_policy" ON public.agencies;
DROP POLICY IF EXISTS "agencies_update_policy" ON public.agencies;
DROP POLICY IF EXISTS "agencies_delete_policy" ON public.agencies;

CREATE POLICY "agencies_select_policy" ON public.agencies FOR SELECT TO authenticated
USING (
  public.is_owner()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()
  )
  OR (
    id = public.get_user_agency_id()
  )
);

CREATE POLICY "agencies_insert_policy" ON public.agencies FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_agency()
  AND (
    public.is_owner()
    OR (
      public.get_user_role() = 'SUPERADMIN'
      AND tenant_id = public.get_user_tenant_id()
    )
  )
);

CREATE POLICY "agencies_update_policy" ON public.agencies FOR UPDATE TO authenticated
USING (
  public.can_manage_agency(id)
)
WITH CHECK (
  public.can_manage_agency(id)
);

CREATE POLICY "agencies_delete_policy" ON public.agencies FOR DELETE TO authenticated
USING (
  public.is_owner()
);

-- ============================================================================
-- Step 6: Create helper view for user management UI
-- ============================================================================

CREATE OR REPLACE VIEW public.users_with_details AS
SELECT
  u.id,
  u.name,
  u.email,
  u.role,
  u.agency_id,
  u.tenant_id,
  u.provider,
  u.created_at,
  a.name as agency_name,
  t.name as tenant_name,
  a.status as agency_status
FROM public.users u
LEFT JOIN public.agencies a ON u.agency_id = a.id
LEFT JOIN public.tenants t ON u.tenant_id = t.id;

GRANT SELECT ON public.users_with_details TO authenticated;

-- ============================================================================
-- Step 7: Add helpful comments
-- ============================================================================

COMMENT ON FUNCTION public.can_create_user_with_role(public.user_role) IS
'Checks if authenticated user has permission to create a user with the target role';

COMMENT ON FUNCTION public.can_manage_user(uuid) IS
'Checks if authenticated user can manage (update/delete) the target user';

COMMENT ON FUNCTION public.get_allowed_roles_for_creation() IS
'Returns array of roles that authenticated user is allowed to create';

COMMENT ON FUNCTION public.can_create_agency() IS
'Checks if authenticated user has permission to create agencies';

COMMENT ON FUNCTION public.can_manage_agency(uuid) IS
'Checks if authenticated user can manage the target agency';

COMMENT ON VIEW public.users_with_details IS
'Enhanced user view with agency and tenant information for management UIs';

-- Success message
SELECT 'User and Agency management system successfully configured!' as status;
