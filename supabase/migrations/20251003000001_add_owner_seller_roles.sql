-- Migration: Add OWNER and SELLER roles to hierarchy
-- OWNER → SUPERADMIN → ADMIN → SELLER

-- 1. Add OWNER and SELLER to user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SELLER';

-- 2. Add name column to users table (needed for sellers display)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS name text;

-- 3. Make tenant_id nullable for OWNER (they see all tenants)
-- Already nullable in schema ✓

-- 4. Create helper function to check if user is OWNER
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'OWNER'::public.user_role
  );
$$;

-- 5. Create helper function to check if user is assigned to a lead (for SELLERS)
CREATE OR REPLACE FUNCTION public.is_assigned_to_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = _lead_id AND l.assigned_user_id = auth.uid()
  );
$$;

-- 6. OWNER can see ALL tenants
CREATE POLICY IF NOT EXISTS "owner can select all tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (public.is_owner());

CREATE POLICY IF NOT EXISTS "owner can manage all tenants"
  ON public.tenants FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- 7. OWNER can see ALL agencies
CREATE POLICY IF NOT EXISTS "owner can select all agencies"
  ON public.agencies FOR SELECT TO authenticated
  USING (public.is_owner());

CREATE POLICY IF NOT EXISTS "owner can manage all agencies"
  ON public.agencies FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- 8. OWNER can see ALL users
CREATE POLICY IF NOT EXISTS "owner can select all users"
  ON public.users FOR SELECT TO authenticated
  USING (public.is_owner());

CREATE POLICY IF NOT EXISTS "owner can manage all users"
  ON public.users FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- 9. OWNER can see ALL conversations
CREATE POLICY IF NOT EXISTS "owner can select all conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_owner());

-- 10. OWNER can see ALL messages
CREATE POLICY IF NOT EXISTS "owner can select all messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_owner());

-- 11. OWNER can see ALL leads
CREATE POLICY IF NOT EXISTS "owner can select all leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.is_owner());

-- 12. SELLERS can only see their assigned leads
CREATE POLICY IF NOT EXISTS "sellers can select their assigned leads"
  ON public.leads FOR SELECT TO authenticated
  USING (
    assigned_user_id = auth.uid()
    OR public.is_same_agency(agency_id)
    OR public.is_superadmin()
    OR public.is_owner()
  );

-- 13. SELLERS can only update their assigned leads
CREATE POLICY IF NOT EXISTS "sellers can update their assigned leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    assigned_user_id = auth.uid()
    OR public.is_same_agency(agency_id)
    OR public.is_superadmin()
    OR public.is_owner()
  )
  WITH CHECK (
    assigned_user_id = auth.uid()
    OR public.is_same_agency(agency_id)
    OR public.is_superadmin()
    OR public.is_owner()
  );

-- 14. SELLERS can only see conversations linked to their leads
CREATE POLICY IF NOT EXISTS "sellers can select conversations of their leads"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.conversation_id = conversations.id
      AND l.assigned_user_id = auth.uid()
    )
    OR public.is_same_agency(agency_id)
    OR public.is_superadmin()
    OR public.is_owner()
  );

-- 15. SELLERS can only see messages from conversations of their leads
CREATE POLICY IF NOT EXISTS "sellers can select messages of their leads"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.leads l ON l.conversation_id = c.id
      WHERE c.id = messages.conversation_id
      AND l.assigned_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND public.is_same_agency(c.agency_id)
    )
    OR public.is_superadmin()
    OR public.is_owner()
  );

-- 16. SELLERS can insert messages in their conversations
CREATE POLICY IF NOT EXISTS "sellers can insert messages in their conversations"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.leads l ON l.conversation_id = c.id
      WHERE c.id = conversation_id
      AND l.assigned_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND public.is_same_agency(c.agency_id)
    )
    OR public.is_superadmin()
    OR public.is_owner()
  );

-- 17. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON public.leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_tenant_agency_role ON public.users(tenant_id, agency_id, role);

-- 18. Comment for documentation
COMMENT ON FUNCTION public.is_owner() IS 'Check if authenticated user has OWNER role (sees all tenants)';
COMMENT ON FUNCTION public.is_assigned_to_lead(uuid) IS 'Check if authenticated user is assigned to a specific lead (for SELLERS)';
