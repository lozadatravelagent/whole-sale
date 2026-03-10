-- ============================================================
-- Migration: RLS policies use JWT claims instead of users table
-- Date: 2026-03-09
--
-- Problem: Helper functions and RLS policies query the users table
-- on every request, causing performance overhead and recursion risk.
--
-- Solution: Read role/agency_id/tenant_id from JWT app_metadata
-- (populated by trigger in 20251004000010_populate_jwt_claims.sql)
-- with COALESCE fallback to users table for safety.
-- ============================================================

-- ============================================================
-- 1. RECREATE HELPER FUNCTIONS WITH COALESCE FALLBACK
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'user_role',
    (SELECT role::text FROM public.users WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid,
    (SELECT agency_id FROM public.users WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'user_role',
    (SELECT role::text FROM public.users WHERE id = auth.uid())
  ) = 'OWNER';
$$;

-- ============================================================
-- 2. UPDATE get_superadmin_agency_ids TO USE JWT FOR ROLE CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_superadmin_agency_ids()
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_role text;
  agency_ids UUID[];
BEGIN
  -- Use JWT claims first, fallback to table
  cur_role := COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'user_role',
    (SELECT role::text FROM public.users WHERE id = auth.uid())
  );

  IF cur_role != 'SUPERADMIN' THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  SELECT ARRAY_AGG(agency_id) INTO agency_ids
  FROM public.superadmin_agency_assignments
  WHERE superadmin_id = auth.uid();

  RETURN COALESCE(agency_ids, ARRAY[]::UUID[]);
END;
$$;

-- ============================================================
-- 3. UPDATE PLPGSQL HELPER FUNCTIONS TO USE JWT CLAIMS
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_create_user_with_role(target_role public.user_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_role text;
BEGIN
  cur_role := public.get_user_role();

  IF cur_role = 'OWNER' THEN RETURN true; END IF;
  IF cur_role = 'SUPERADMIN' AND target_role IN ('SUPERADMIN', 'ADMIN', 'SELLER') THEN RETURN true; END IF;
  IF cur_role = 'ADMIN' AND target_role = 'SELLER' THEN RETURN true; END IF;

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
  cur_role text;
  target_user_agency_id uuid;
  target_user_role text;
  superadmin_agencies UUID[];
BEGIN
  cur_role := public.get_user_role();

  SELECT role::text, agency_id INTO target_user_role, target_user_agency_id
  FROM public.users
  WHERE id = target_user_id;

  IF cur_role = 'OWNER' THEN RETURN true; END IF;

  IF cur_role = 'SUPERADMIN' AND target_user_role != 'OWNER' THEN
    superadmin_agencies := public.get_superadmin_agency_ids();
    RETURN target_user_agency_id = ANY(superadmin_agencies);
  END IF;

  IF cur_role = 'ADMIN' AND target_user_role = 'SELLER' THEN
    RETURN public.get_user_agency_id() = target_user_agency_id;
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
  cur_role text;
BEGIN
  cur_role := public.get_user_role();

  CASE cur_role
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

CREATE OR REPLACE FUNCTION public.can_create_agency()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_role text;
BEGIN
  cur_role := public.get_user_role();
  RETURN cur_role IN ('OWNER', 'SUPERADMIN');
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
  cur_role text;
  target_agency_tenant_id uuid;
BEGIN
  cur_role := public.get_user_role();

  IF cur_role = 'OWNER' THEN RETURN true; END IF;

  IF cur_role = 'SUPERADMIN' THEN
    SELECT tenant_id INTO target_agency_tenant_id
    FROM public.agencies
    WHERE id = target_agency_id;
    RETURN public.get_user_tenant_id() = target_agency_tenant_id;
  END IF;

  RETURN false;
END;
$$;

-- ============================================================
-- 4. REWRITE RLS POLICIES — USERS TABLE
-- ============================================================

-- Drop all existing user policies
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "owner_select_all_users" ON public.users;
DROP POLICY IF EXISTS "superadmin_select_tenant_users" ON public.users;
DROP POLICY IF EXISTS "admin_select_agency_users" ON public.users;
DROP POLICY IF EXISTS "users can read own data" ON public.users;
DROP POLICY IF EXISTS "owner can read all users" ON public.users;
DROP POLICY IF EXISTS "owner_full_access" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

CREATE POLICY "users_select_policy"
  ON public.users FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_owner()
    OR (
      public.get_user_role() = 'SUPERADMIN'
      AND agency_id = ANY(public.get_superadmin_agency_ids())
    )
    OR (
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
    )
  );

CREATE POLICY "users_insert_policy"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (
    public.can_create_user_with_role(role)
    AND (
      public.is_owner()
      OR (
        public.get_user_role() = 'SUPERADMIN'
        AND agency_id = ANY(public.get_superadmin_agency_ids())
      )
      OR (
        public.get_user_role() = 'ADMIN'
        AND agency_id = public.get_user_agency_id()
        AND role = 'SELLER'::public.user_role
      )
    )
  );

CREATE POLICY "users_update_policy"
  ON public.users FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR public.can_manage_user(id)
  )
  WITH CHECK (
    id = auth.uid()
    OR public.can_manage_user(id)
  );

CREATE POLICY "users_delete_policy"
  ON public.users FOR DELETE TO authenticated
  USING (public.is_owner());

-- ============================================================
-- 5. REWRITE RLS POLICIES — CONVERSATIONS TABLE
-- ============================================================

DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;

CREATE POLICY "conversations_select_policy"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
  );

CREATE POLICY "conversations_insert_policy"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND agency_id = public.get_user_agency_id()
  );

CREATE POLICY "conversations_update_policy"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    public.is_owner()
    OR agency_id = public.get_user_agency_id()
    OR (
      public.get_user_role() = 'SUPERADMIN'
      AND EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id = conversations.agency_id
        AND a.tenant_id = public.get_user_tenant_id()
      )
    )
  );

-- ============================================================
-- 6. REWRITE RLS POLICIES — LEADS TABLE
-- ============================================================

DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;

CREATE POLICY "leads_select_policy"
  ON public.leads FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR (public.get_user_role() = 'SUPERADMIN' AND tenant_id = public.get_user_tenant_id())
    OR (public.get_user_role() = 'ADMIN' AND agency_id = public.get_user_agency_id())
    OR (public.get_user_role() = 'SELLER' AND assigned_user_id = auth.uid())
  );

CREATE POLICY "leads_insert_policy"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = public.get_user_agency_id()
    OR public.is_owner()
  );

CREATE POLICY "leads_update_policy"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    public.is_owner()
    OR (public.get_user_role() = 'SUPERADMIN' AND tenant_id = public.get_user_tenant_id())
    OR (public.get_user_role() = 'ADMIN' AND agency_id = public.get_user_agency_id())
    OR (public.get_user_role() = 'SELLER' AND assigned_user_id = auth.uid())
  );

-- ============================================================
-- 7. REWRITE RLS POLICIES — MESSAGES TABLE
-- ============================================================

DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;

CREATE POLICY "messages_select_policy"
  ON public.messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "messages_insert_policy"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE created_by = auth.uid()
    )
  );

-- ============================================================
-- 8. REWRITE RLS POLICIES — SECTIONS TABLE
-- ============================================================

DROP POLICY IF EXISTS "sections_select_policy" ON public.sections;

CREATE POLICY "sections_select_policy"
  ON public.sections FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR agency_id = public.get_user_agency_id()
  );

-- ============================================================
-- 9. REWRITE RLS POLICIES — AGENCIES TABLE
-- ============================================================

DROP POLICY IF EXISTS "agencies_select_policy" ON public.agencies;
DROP POLICY IF EXISTS "agencies_insert_policy" ON public.agencies;
DROP POLICY IF EXISTS "agencies_update_policy" ON public.agencies;
DROP POLICY IF EXISTS "agencies_delete_policy" ON public.agencies;

CREATE POLICY "agencies_select_policy"
  ON public.agencies FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR (
      public.get_user_role() = 'SUPERADMIN'
      AND tenant_id = public.get_user_tenant_id()
    )
    OR id = public.get_user_agency_id()
  );

CREATE POLICY "agencies_insert_policy"
  ON public.agencies FOR INSERT TO authenticated
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

CREATE POLICY "agencies_update_policy"
  ON public.agencies FOR UPDATE TO authenticated
  USING (public.can_manage_agency(id))
  WITH CHECK (public.can_manage_agency(id));

CREATE POLICY "agencies_delete_policy"
  ON public.agencies FOR DELETE TO authenticated
  USING (public.is_owner());

-- ============================================================
-- 10. REWRITE RLS POLICIES — SUPERADMIN_AGENCY_ASSIGNMENTS TABLE
-- Skipped: table does not exist yet in this database.
-- When superadmin_agency_assignments is created, add these
-- policies in a separate migration.
-- ============================================================
