-- FIX: Helper functions must NOT query users table to avoid infinite recursion
-- Solution: Read from JWT claims instead

-- Drop existing helper functions
DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.get_user_agency_id();
DROP FUNCTION IF EXISTS public.get_user_tenant_id();

-- Create helper functions that read from JWT app_metadata (no recursion)
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

-- Note: For these functions to work, we need to ensure JWT claims are populated
-- This will be done via a database trigger on the users table
