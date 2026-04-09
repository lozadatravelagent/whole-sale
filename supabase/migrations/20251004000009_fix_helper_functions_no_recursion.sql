-- FIX: Helper functions must NOT query users table to avoid infinite recursion
-- Solution: Read from JWT claims instead

-- Recreate helper functions that read from JWT app_metadata (no recursion)
-- CASCADE needed because return type changes from user_role to text,
-- which requires dropping dependent policies (they are recreated in later migrations)
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_agency_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_tenant_id() CASCADE;
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
