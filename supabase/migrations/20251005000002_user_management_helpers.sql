-- Helper functions and RLS enhancements for User and Agency Management

-- ============================================================================
-- HELPER FUNCTIONS FOR USER ROLE VALIDATION
-- ============================================================================

-- Function to check if user can create a specific role
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
  -- Get current user's role
  SELECT role INTO current_user_role
  FROM public.users
  WHERE id = auth.uid();

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

-- Function to check if user can manage another user
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
  -- Get current user info
  SELECT role, tenant_id, agency_id INTO current_user_role, current_user_tenant_id, current_user_agency_id
  FROM public.users
  WHERE id = auth.uid();

  -- Get target user info
  SELECT role, tenant_id, agency_id INTO target_user_role, target_user_tenant_id, target_user_agency_id
  FROM public.users
  WHERE id = target_user_id;

  -- OWNER can manage anyone
  IF current_user_role = 'OWNER' THEN
    RETURN true;
  END IF;

  -- SUPERADMIN can manage users in their agency (except other OWNERs)
  IF current_user_role = 'SUPERADMIN' AND target_user_role != 'OWNER' THEN
    RETURN current_user_agency_id = target_user_agency_id;
  END IF;

  -- ADMIN can manage SELLERS in their agency
  IF current_user_role = 'ADMIN' AND target_user_role = 'SELLER' THEN
    RETURN current_user_agency_id = target_user_agency_id;
  END IF;

  -- Default: cannot manage
  RETURN false;
END;
$$;

-- Function to get allowed roles for user creation
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
-- HELPER FUNCTIONS FOR AGENCY MANAGEMENT
-- ============================================================================

-- Function to check if user can create agencies
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

  -- Only OWNER and SUPERADMIN can create agencies
  RETURN current_user_role IN ('OWNER', 'SUPERADMIN');
END;
$$;

-- Function to check if user can manage a specific agency
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
  -- Get current user info
  SELECT role, tenant_id INTO current_user_role, current_user_tenant_id
  FROM public.users
  WHERE id = auth.uid();

  -- Get target agency's tenant
  SELECT tenant_id INTO target_agency_tenant_id
  FROM public.agencies
  WHERE id = target_agency_id;

  -- OWNER can manage any agency
  IF current_user_role = 'OWNER' THEN
    RETURN true;
  END IF;

  -- SUPERADMIN can manage agencies in their tenant
  IF current_user_role = 'SUPERADMIN' THEN
    RETURN current_user_tenant_id = target_agency_tenant_id;
  END IF;

  -- Default: cannot manage
  RETURN false;
END;
$$;

-- ============================================================================
-- ENHANCED RLS POLICIES FOR USER MANAGEMENT
-- ============================================================================

-- Drop existing restrictive user policies
DROP POLICY IF EXISTS "user can select self" ON public.users;
DROP POLICY IF EXISTS "user can update self" ON public.users;
DROP POLICY IF EXISTS "superadmins can select users in tenant" ON public.users;
DROP POLICY IF EXISTS "superadmins can insert users" ON public.users;
DROP POLICY IF EXISTS "superadmins can update users in tenant" ON public.users;
DROP POLICY IF EXISTS "superadmins can delete users in tenant" ON public.users;

-- Create comprehensive user management policies

-- SELECT: Users can see themselves + managers can see their subordinates
CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid() -- Can see self
  OR public.is_owner() -- OWNER sees all
  OR (
    -- SUPERADMIN sees users in their assigned agency
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = public.get_user_agency_id()
  )
  OR (
    -- ADMIN sees sellers in their agency
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

-- INSERT: Only those who can create users
CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    -- OWNER can create in any tenant/agency
    public.is_owner()
    OR (
      -- SUPERADMIN can create in their assigned agency
      public.get_user_role() = 'SUPERADMIN'
      AND agency_id = public.get_user_agency_id()
    )
    OR (
      -- ADMIN can create SELLERS in their agency
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);

-- UPDATE: Users can update themselves + managers can update subordinates
CREATE POLICY "users_update_policy" ON public.users FOR UPDATE TO authenticated
USING (
  id = auth.uid() -- Can update self (limited fields)
  OR public.can_manage_user(id) -- Managers can update subordinates
)
WITH CHECK (
  id = auth.uid() -- Users updating themselves
  OR public.can_manage_user(id) -- Managers updating subordinates
);

-- DELETE: Only OWNER can delete users
CREATE POLICY "users_delete_policy" ON public.users FOR DELETE TO authenticated
USING (
  public.is_owner() -- Only OWNER can hard delete
);

-- ============================================================================
-- ENHANCED RLS POLICIES FOR AGENCY MANAGEMENT
-- ============================================================================

-- Agencies SELECT is already good, but let's ensure it's comprehensive
DROP POLICY IF EXISTS "owner can select all agencies" ON public.agencies;
DROP POLICY IF EXISTS "superadmins can select agencies in tenant" ON public.agencies;
DROP POLICY IF EXISTS "admins can select their agency" ON public.agencies;

CREATE POLICY "agencies_select_policy" ON public.agencies FOR SELECT TO authenticated
USING (
  public.is_owner() -- OWNER sees all
  OR (
    -- SUPERADMIN sees agencies in their tenant
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()
  )
  OR (
    -- ADMIN sees their own agency
    id = public.get_user_agency_id()
  )
);

-- Agencies INSERT
DROP POLICY IF EXISTS "owner can manage all agencies" ON public.agencies;
DROP POLICY IF EXISTS "superadmins can manage agencies" ON public.agencies;

CREATE POLICY "agencies_insert_policy" ON public.agencies FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_agency()
  AND (
    public.is_owner() -- OWNER can create in any tenant
    OR (
      -- SUPERADMIN can create in their tenant
      public.get_user_role() = 'SUPERADMIN'
      AND tenant_id = public.get_user_tenant_id()
    )
  )
);

-- Agencies UPDATE
CREATE POLICY "agencies_update_policy" ON public.agencies FOR UPDATE TO authenticated
USING (
  public.can_manage_agency(id)
)
WITH CHECK (
  public.can_manage_agency(id)
);

-- Agencies DELETE: Only OWNER
CREATE POLICY "agencies_delete_policy" ON public.agencies FOR DELETE TO authenticated
USING (
  public.is_owner() -- Only OWNER can hard delete
);

-- ============================================================================
-- HELPER VIEWS FOR USER MANAGEMENT UI
-- ============================================================================

-- View: Users with agency and tenant names (for listing)
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

-- Grant access to the view (RLS will still apply through base tables)
GRANT SELECT ON public.users_with_details TO authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
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
