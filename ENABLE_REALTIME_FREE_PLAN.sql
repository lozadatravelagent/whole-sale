-- ============================================================================
-- ENABLE REALTIME FOR FREE PLAN (Without Replication UI)
-- Execute this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Check if supabase_realtime publication exists
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- Step 2: Add messages table to supabase_realtime publication
-- This enables Realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 3: Set replica identity to FULL (for tracking all changes)
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Step 4: Grant necessary permissions to the authenticated role
GRANT SELECT ON messages TO authenticated;
GRANT SELECT ON messages TO anon;

-- Step 5: Verify the configuration
SELECT
  pt.schemaname,
  pt.tablename,
  pt.pubname,
  pc.relreplident,
  CASE pc.relreplident
    WHEN 'd' THEN 'default (primary key)'
    WHEN 'f' THEN 'full (all columns)'
    WHEN 'i' THEN 'index'
    WHEN 'n' THEN 'nothing'
  END as replica_identity_type
FROM pg_publication_tables pt
JOIN pg_class pc ON pc.relname = pt.tablename
JOIN pg_namespace pn ON pn.oid = pc.relnamespace
WHERE pt.pubname = 'supabase_realtime'
  AND pt.schemaname = 'public'
  AND pt.tablename = 'messages';

-- ============================================================================
-- VERIFICATION: Check Realtime status
-- ============================================================================
SELECT
  'messages' as table_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    )
    THEN '✅ Realtime ENABLED'
    ELSE '❌ Realtime DISABLED'
  END as realtime_status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT '✅ Realtime should now work for messages table!' as status;
