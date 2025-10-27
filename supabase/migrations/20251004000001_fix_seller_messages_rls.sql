-- ============================================================
-- FIX: Complete messages INSERT policy for all roles
-- Allow each role to insert messages based on hierarchy and ownership
-- ============================================================

-- Drop existing messages_insert_policy
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;

-- Create comprehensive INSERT policy for messages
-- Hierarchy: OWNER → SUPERADMIN → ADMIN → SELLER
CREATE POLICY "messages_insert_policy"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    -- ========================================
    -- 1. OWNER: Can insert messages in ANY conversation (global access)
    -- ========================================
    public.get_user_role() = 'OWNER'::public.user_role

    OR

    -- ========================================
    -- 2. SUPERADMIN: Can insert in conversations of agencies within their tenant
    -- ========================================
    (
      public.get_user_role() = 'SUPERADMIN'::public.user_role
      AND
      conversation_id IN (
        SELECT c.id FROM public.conversations c
        INNER JOIN public.agencies a ON c.agency_id = a.id
        WHERE a.tenant_id = public.get_user_tenant_id()
      )
    )

    OR

    -- ========================================
    -- 3. ADMIN: Can insert in conversations of their specific agency
    -- ========================================
    (
      public.get_user_role() = 'ADMIN'::public.user_role
      AND
      conversation_id IN (
        SELECT id FROM public.conversations
        WHERE agency_id = public.get_user_agency_id()
      )
    )

    OR

    -- ========================================
    -- 4. SELLER: Can insert in conversations of their agency
    --    This allows sellers to:
    --    - Start new chats (before lead is created)
    --    - Chat in conversations of their agency
    --    - Work with leads assigned to them
    -- ========================================
    (
      public.get_user_role() = 'SELLER'::public.user_role
      AND
      conversation_id IN (
        SELECT id FROM public.conversations
        WHERE agency_id = public.get_user_agency_id()
      )
    )
  );

-- Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_leads_conversation_assigned
  ON public.leads(conversation_id, assigned_user_id)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_agency
  ON public.conversations(agency_id);

-- Add documentation comment
COMMENT ON POLICY "messages_insert_policy" ON public.messages IS
  'Role-based message insertion: OWNER (all), SUPERADMIN (tenant agencies), ADMIN (own agency), SELLER (agency conversations)';
