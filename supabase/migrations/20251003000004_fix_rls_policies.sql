-- ============================================================
-- FIX: RLS Policies causing 500 errors
-- Issue: Multiple policies with conflicting logic
-- Solution: Consolidate into single policies with OR conditions
-- ============================================================

-- === USERS TABLE ===
-- Drop all existing policies
DROP POLICY IF EXISTS "users can read own data" ON public.users;
DROP POLICY IF EXISTS "owner can read all users" ON public.users;
DROP POLICY IF EXISTS "superadmin can read tenant users" ON public.users;
DROP POLICY IF EXISTS "admin can read agency users" ON public.users;

-- Create single unified SELECT policy for users
CREATE POLICY "users_select_policy"
  ON public.users FOR SELECT TO authenticated
  USING (
    -- Users can always see their own data
    id = auth.uid()
    OR
    -- OWNER can see all users
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
    OR
    -- SUPERADMIN can see users in their tenant
    (
      tenant_id IN (
        SELECT tenant_id FROM public.users
        WHERE id = auth.uid() AND role = 'SUPERADMIN'::public.user_role
      )
    )
    OR
    -- ADMIN can see users in their agency
    (
      agency_id IN (
        SELECT agency_id FROM public.users
        WHERE id = auth.uid() AND role = 'ADMIN'::public.user_role
      )
    )
  );

-- === CONVERSATIONS TABLE ===
-- Drop existing conversation policies
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;

-- Create unified conversation policies
CREATE POLICY "conversations_select_policy"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    -- OWNER can see all
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
    OR
    -- SUPERADMIN can see conversations in their tenant
    agency_id IN (
      SELECT a.id FROM public.agencies a
      INNER JOIN public.users u ON u.tenant_id = a.tenant_id
      WHERE u.id = auth.uid() AND u.role = 'SUPERADMIN'::public.user_role
    )
    OR
    -- ADMIN and SELLER can see conversations in their agency
    agency_id IN (
      SELECT agency_id FROM public.users
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "conversations_insert_policy"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    -- Users can only create conversations for their own agency
    agency_id IN (
      SELECT agency_id FROM public.users
      WHERE id = auth.uid()
    )
    OR
    -- OWNER can create for any agency
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
  );

CREATE POLICY "conversations_update_policy"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    -- Same as SELECT - can update what you can see
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
    OR
    agency_id IN (
      SELECT a.id FROM public.agencies a
      INNER JOIN public.users u ON u.tenant_id = a.tenant_id
      WHERE u.id = auth.uid() AND u.role = 'SUPERADMIN'::public.user_role
    )
    OR
    agency_id IN (
      SELECT agency_id FROM public.users
      WHERE id = auth.uid()
    )
  );

-- === LEADS TABLE ===
-- Simplify leads policies to avoid conflicts
DROP POLICY IF EXISTS "sellers can select their assigned leads" ON public.leads;
DROP POLICY IF EXISTS "temp_dev_policy_all_leads" ON public.leads;

CREATE POLICY "leads_select_policy"
  ON public.leads FOR SELECT TO authenticated
  USING (
    -- OWNER can see all leads
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
    OR
    -- SUPERADMIN can see leads in their tenant
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid() AND role = 'SUPERADMIN'::public.user_role
    )
    OR
    -- ADMIN can see all leads in their agency
    agency_id IN (
      SELECT agency_id FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'::public.user_role
    )
    OR
    -- SELLER can see their assigned leads
    assigned_user_id = auth.uid()
  );

CREATE POLICY "leads_insert_policy"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    -- Users can create leads for their agency
    agency_id IN (
      SELECT agency_id FROM public.users
      WHERE id = auth.uid()
    )
    OR
    -- OWNER can create for any agency
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
  );

CREATE POLICY "leads_update_policy"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    -- OWNER can update all
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
    OR
    -- SUPERADMIN can update in their tenant
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE id = auth.uid() AND role = 'SUPERADMIN'::public.user_role
    )
    OR
    -- ADMIN can update in their agency
    agency_id IN (
      SELECT agency_id FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'::public.user_role
    )
    OR
    -- SELLER can update their assigned leads
    assigned_user_id = auth.uid()
  );

-- === MESSAGES TABLE ===
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;

CREATE POLICY "messages_select_policy"
  ON public.messages FOR SELECT TO authenticated
  USING (
    -- Can see messages in conversations they can access
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE
        -- Same logic as conversations SELECT
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
        )
        OR
        agency_id IN (
          SELECT a.id FROM public.agencies a
          INNER JOIN public.users u ON u.tenant_id = a.tenant_id
          WHERE u.id = auth.uid() AND u.role = 'SUPERADMIN'::public.user_role
        )
        OR
        agency_id IN (
          SELECT agency_id FROM public.users
          WHERE id = auth.uid()
        )
    )
  );

CREATE POLICY "messages_insert_policy"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    -- Can insert messages in conversations they can access
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
        )
        OR
        agency_id IN (
          SELECT agency_id FROM public.users
          WHERE id = auth.uid()
        )
    )
  );

-- === SECTIONS TABLE ===
DROP POLICY IF EXISTS "sections_select_policy" ON public.sections;

CREATE POLICY "sections_select_policy"
  ON public.sections FOR SELECT TO authenticated
  USING (
    -- OWNER can see all sections
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
    )
    OR
    -- Others can see sections in their agency
    agency_id IN (
      SELECT agency_id FROM public.users
      WHERE id = auth.uid()
    )
  );
