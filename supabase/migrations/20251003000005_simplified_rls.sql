-- ============================================================
-- SIMPLIFIED RLS POLICIES - Fix 500 errors
-- Use helper functions to avoid circular references
-- ============================================================

-- === HELPER FUNCTIONS (if not exist) ===
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT agency_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

-- === USERS TABLE ===
DROP POLICY IF EXISTS "users can read own data" ON public.users;
DROP POLICY IF EXISTS "owner can read all users" ON public.users;
DROP POLICY IF EXISTS "superadmin can read tenant users" ON public.users;
DROP POLICY IF EXISTS "admin can read agency users" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy"
  ON public.users FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR
    public.get_user_role() = 'OWNER'::public.user_role
    OR
    (public.get_user_role() = 'SUPERADMIN'::public.user_role AND tenant_id = public.get_user_tenant_id())
    OR
    (public.get_user_role() = 'ADMIN'::public.user_role AND agency_id = public.get_user_agency_id())
  );

-- === CONVERSATIONS TABLE ===
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;

CREATE POLICY "conversations_select_policy"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'OWNER'::public.user_role
    OR
    agency_id = public.get_user_agency_id()
    OR
    (
      public.get_user_role() = 'SUPERADMIN'::public.user_role
      AND
      EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id = conversations.agency_id
        AND a.tenant_id = public.get_user_tenant_id()
      )
    )
  );

CREATE POLICY "conversations_insert_policy"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = public.get_user_agency_id()
    OR
    public.get_user_role() = 'OWNER'::public.user_role
  );

CREATE POLICY "conversations_update_policy"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'OWNER'::public.user_role
    OR
    agency_id = public.get_user_agency_id()
    OR
    (
      public.get_user_role() = 'SUPERADMIN'::public.user_role
      AND
      EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id = conversations.agency_id
        AND a.tenant_id = public.get_user_tenant_id()
      )
    )
  );

-- === LEADS TABLE ===
DROP POLICY IF EXISTS "sellers can select their assigned leads" ON public.leads;
DROP POLICY IF EXISTS "temp_dev_policy_all_leads" ON public.leads;
DROP POLICY IF EXISTS "leads_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_update_policy" ON public.leads;

CREATE POLICY "leads_select_policy"
  ON public.leads FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'OWNER'::public.user_role
    OR
    (public.get_user_role() = 'SUPERADMIN'::public.user_role AND tenant_id = public.get_user_tenant_id())
    OR
    (public.get_user_role() = 'ADMIN'::public.user_role AND agency_id = public.get_user_agency_id())
    OR
    (public.get_user_role() = 'SELLER'::public.user_role AND assigned_user_id = auth.uid())
  );

CREATE POLICY "leads_insert_policy"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = public.get_user_agency_id()
    OR
    public.get_user_role() = 'OWNER'::public.user_role
  );

CREATE POLICY "leads_update_policy"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'OWNER'::public.user_role
    OR
    (public.get_user_role() = 'SUPERADMIN'::public.user_role AND tenant_id = public.get_user_tenant_id())
    OR
    (public.get_user_role() = 'ADMIN'::public.user_role AND agency_id = public.get_user_agency_id())
    OR
    (public.get_user_role() = 'SELLER'::public.user_role AND assigned_user_id = auth.uid())
  );

-- === MESSAGES TABLE ===
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;

CREATE POLICY "messages_select_policy"
  ON public.messages FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'OWNER'::public.user_role
    OR
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE agency_id = public.get_user_agency_id()
    )
    OR
    (
      public.get_user_role() = 'SUPERADMIN'::public.user_role
      AND
      conversation_id IN (
        SELECT c.id FROM public.conversations c
        INNER JOIN public.agencies a ON c.agency_id = a.id
        WHERE a.tenant_id = public.get_user_tenant_id()
      )
    )
  );

CREATE POLICY "messages_insert_policy"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'OWNER'::public.user_role
    OR
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE agency_id = public.get_user_agency_id()
    )
  );

-- === SECTIONS TABLE ===
DROP POLICY IF EXISTS "sections_select_policy" ON public.sections;

CREATE POLICY "sections_select_policy"
  ON public.sections FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'OWNER'::public.user_role
    OR
    agency_id = public.get_user_agency_id()
  );
