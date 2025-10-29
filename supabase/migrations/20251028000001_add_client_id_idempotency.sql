-- ============================================================
-- Migration: Add client_id for message idempotency
-- Date: 2025-10-28
-- Purpose: Prevent duplicate messages by enforcing unique (conversation_id, client_id)
-- ============================================================

-- ✅ STEP 1: Add client_id column to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS client_id uuid;

-- ✅ STEP 2: Backfill existing messages with random UUIDs (optional, for legacy data)
-- This prevents issues with the UNIQUE constraint for old messages
UPDATE public.messages
SET client_id = gen_random_uuid()
WHERE client_id IS NULL;

-- ✅ STEP 3: Create unique index on (conversation_id, client_id)
-- WHERE clause makes it a partial index (only enforces for non-NULL client_id)
-- This allows old messages without client_id to coexist
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conversation_client_unique
ON public.messages(conversation_id, client_id)
WHERE client_id IS NOT NULL;

-- ✅ STEP 4: Create performance index on client_id alone (for lookups)
CREATE INDEX IF NOT EXISTS idx_messages_client_id
ON public.messages(client_id)
WHERE client_id IS NOT NULL;

-- ✅ STEP 5: Add column documentation
COMMENT ON COLUMN public.messages.client_id IS
'Client-generated UUID v4 for idempotency. Prevents duplicate messages from same client. Used with unique constraint on (conversation_id, client_id).';

-- ✅ STEP 6: Verify RLS policies still work (no changes needed, just verification)
-- The existing RLS policies on messages table should work unchanged:
-- - messages_select_policy (or messages_select_unified)
-- - messages_insert_policy (or messages_insert_unified)

-- ============================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================

-- 1. Check that column was added
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'messages' AND column_name = 'client_id';

-- 2. Check that unique index exists
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'messages' AND indexname LIKE '%client%';

-- 3. Test idempotency (should fail with unique violation)
-- INSERT INTO public.messages (conversation_id, role, content, client_id, created_at)
-- VALUES ('some-conv-id', 'user', '{"text": "test"}', 'test-client-id-123', now());
-- INSERT INTO public.messages (conversation_id, role, content, client_id, created_at)
-- VALUES ('same-conv-id', 'user', '{"text": "test2"}', 'test-client-id-123', now());
-- Expected: ERROR - duplicate key value violates unique constraint

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================

-- DROP INDEX IF EXISTS idx_messages_conversation_client_unique;
-- DROP INDEX IF EXISTS idx_messages_client_id;
-- ALTER TABLE public.messages DROP COLUMN IF EXISTS client_id;
