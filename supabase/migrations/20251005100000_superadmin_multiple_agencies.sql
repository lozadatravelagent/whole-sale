-- Enable SUPERADMIN to be assigned to multiple agencies
-- This creates a many-to-many relationship between SUPERADMIN users and agencies

-- Create junction table for SUPERADMIN agency assignments
CREATE TABLE IF NOT EXISTS public.superadmin_agency_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Ensure unique assignments
  UNIQUE(superadmin_id, agency_id),

  -- Ensure only SUPERADMIN users can be assigned
  CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = superadmin_id
      AND role = 'SUPERADMIN'::public.user_role
    )
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_superadmin_assignments_superadmin
  ON public.superadmin_agency_assignments(superadmin_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_assignments_agency
  ON public.superadmin_agency_assignments(agency_id);

-- Enable RLS
ALTER TABLE public.superadmin_agency_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for superadmin_agency_assignments
-- OWNER can see all assignments
CREATE POLICY "owner_can_view_all_assignments"
  ON public.superadmin_agency_assignments FOR SELECT
  TO authenticated
  USING (public.is_owner());

-- SUPERADMIN can see their own assignments
CREATE POLICY "superadmin_can_view_own_assignments"
  ON public.superadmin_agency_assignments FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'SUPERADMIN'
    AND superadmin_id = auth.uid()
  );

-- Only OWNER can insert/update/delete assignments
CREATE POLICY "owner_can_manage_assignments"
  ON public.superadmin_agency_assignments FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Helper function to get SUPERADMIN's assigned agencies
CREATE OR REPLACE FUNCTION public.get_superadmin_agency_ids()
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.user_role;
  agency_ids UUID[];
BEGIN
  -- Get current user's role
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();

  -- If not SUPERADMIN, return empty array
  IF user_role != 'SUPERADMIN' THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  -- Get assigned agency IDs
  SELECT ARRAY_AGG(agency_id) INTO agency_ids
  FROM public.superadmin_agency_assignments
  WHERE superadmin_id = auth.uid();

  RETURN COALESCE(agency_ids, ARRAY[]::UUID[]);
END;
$$;

-- Update users_select_policy to use multiple agency assignments for SUPERADMIN
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

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
    -- ADMIN sees sellers in their agency
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

-- Update users_insert_policy for SUPERADMIN
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    -- OWNER can create in any tenant/agency
    public.is_owner()
    OR (
      -- SUPERADMIN can create in their assigned agencies
      public.get_user_role() = 'SUPERADMIN'
      AND agency_id = ANY(public.get_superadmin_agency_ids())
    )
    OR (
      -- ADMIN can create SELLERS in their agency
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);

-- Update can_manage_user function for SUPERADMIN with multiple agencies
CREATE OR REPLACE FUNCTION public.can_manage_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role public.user_role;
  current_user_agency_id uuid;
  target_user_agency_id uuid;
  target_user_role public.user_role;
  superadmin_agencies UUID[];
BEGIN
  -- Get current user info
  SELECT role, agency_id INTO current_user_role, current_user_agency_id
  FROM public.users
  WHERE id = auth.uid();

  -- Get target user info
  SELECT role, agency_id INTO target_user_role, target_user_agency_id
  FROM public.users
  WHERE id = target_user_id;

  -- OWNER can manage anyone
  IF current_user_role = 'OWNER' THEN
    RETURN true;
  END IF;

  -- SUPERADMIN can manage users in their assigned agencies (except other OWNERs)
  IF current_user_role = 'SUPERADMIN' AND target_user_role != 'OWNER' THEN
    superadmin_agencies := public.get_superadmin_agency_ids();
    RETURN target_user_agency_id = ANY(superadmin_agencies);
  END IF;

  -- ADMIN can manage SELLERS in their agency
  IF current_user_role = 'ADMIN' AND target_user_role = 'SELLER' THEN
    RETURN current_user_agency_id = target_user_agency_id;
  END IF;

  -- Default: cannot manage
  RETURN false;
END;
$$;

-- View for easy querying of SUPERADMIN assignments
CREATE OR REPLACE VIEW public.superadmin_agencies_view AS
SELECT
  sa.id as assignment_id,
  u.id as superadmin_id,
  u.name as superadmin_name,
  u.email as superadmin_email,
  a.id as agency_id,
  a.name as agency_name,
  a.tenant_id,
  t.name as tenant_name,
  sa.assigned_at
FROM public.superadmin_agency_assignments sa
JOIN public.users u ON sa.superadmin_id = u.id
JOIN public.agencies a ON sa.agency_id = a.id
LEFT JOIN public.tenants t ON a.tenant_id = t.id;

-- Grant access
GRANT SELECT ON public.superadmin_agencies_view TO authenticated;

-- Comments
COMMENT ON TABLE public.superadmin_agency_assignments IS
'Junction table allowing SUPERADMIN users to be assigned to multiple agencies';

COMMENT ON FUNCTION public.get_superadmin_agency_ids() IS
'Returns array of agency IDs assigned to the current SUPERADMIN user';

-- Success message
SELECT 'SUPERADMIN multiple agency assignments enabled successfully!' as status;
