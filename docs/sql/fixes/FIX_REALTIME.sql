-- ============================================================================
-- FIX REALTIME FOR MESSAGES TABLE
-- Execute this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Set replica identity to FULL for messages table
-- This allows Realtime to track all changes
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Step 2: Verify the replica identity is set
SELECT schemaname, tablename, relreplident
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
JOIN pg_publication_tables ON pg_publication_tables.tablename = pg_class.relname
WHERE schemaname = 'public' AND tablename = 'messages';

-- Step 3: Ensure the table is in the supabase_realtime publication
-- Check current publication
SELECT * FROM pg_publication_tables WHERE tablename = 'messages';

-- If not in publication, add it:
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 4: Verify RLS policies allow SELECT
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'messages' AND cmd = 'SELECT';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if Realtime is enabled for messages
SELECT
  schemaname,
  tablename,
  CASE
    WHEN tablename IN (SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime')
    THEN '✅ Realtime Enabled'
    ELSE '❌ Realtime Disabled'
  END as realtime_status
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'messages';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT '✅ Run the verification query above to check Realtime status' as status;
