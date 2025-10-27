-- ============================================================
-- UPDATE: ALL USERS can ONLY see conversations THEY CREATED
-- Each conversation is independent and belongs to the user who created it
-- Add created_by field to track conversation ownership
-- ============================================================

-- Add created_by column to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_conversations_created_by
  ON public.conversations(created_by);

-- Update existing conversations to set created_by
-- Try to infer from leads or set to NULL (will be set when user creates new chats)
UPDATE public.conversations c
SET created_by = (
  SELECT l.assigned_user_id
  FROM public.leads l
  WHERE l.conversation_id = c.id
  LIMIT 1
)
WHERE created_by IS NULL;

-- === CONVERSATIONS TABLE ===
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;

CREATE POLICY "conversations_select_policy"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    -- Every user can ONLY see conversations they created
    created_by = auth.uid()
  );

-- When creating a conversation, set created_by automatically
CREATE POLICY "conversations_insert_policy"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    -- Set created_by to current user
    created_by = auth.uid()
    AND
    -- User must belong to the agency
    agency_id = public.get_user_agency_id()
  );

-- === MESSAGES TABLE ===
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;

CREATE POLICY "messages_insert_policy"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    -- Users can only insert messages in conversations they created
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "messages_select_policy"
  ON public.messages FOR SELECT TO authenticated
  USING (
    -- Users can only see messages in conversations they created
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE created_by = auth.uid()
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user_conversation
  ON public.leads(assigned_user_id, conversation_id)
  WHERE conversation_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.conversations.created_by IS
  'User who created this conversation - each conversation belongs to one user';

COMMENT ON POLICY "conversations_select_policy" ON public.conversations IS
  'All users can ONLY see conversations they created (created_by = auth.uid())';

COMMENT ON POLICY "conversations_insert_policy" ON public.conversations IS
  'Users can create conversations in their agency, created_by is auto-set to auth.uid()';

COMMENT ON POLICY "messages_insert_policy" ON public.messages IS
  'Users can ONLY insert messages in their own conversations';

COMMENT ON POLICY "messages_select_policy" ON public.messages IS
  'Users can ONLY see messages in their own conversations';
