-- ============================================================================
-- FIX REALTIME BINDINGS MISMATCH ERROR
-- Execute this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Remove messages from publication (clean slate)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS messages;

-- Step 2: Re-add messages table to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 3: Set replica identity to FULL (required for Realtime)
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Step 4: Grant necessary permissions
GRANT SELECT ON messages TO authenticated;
GRANT SELECT ON messages TO anon;

-- Step 5: Verify publication configuration
SELECT
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'messages';

-- Step 6: Verify replica identity
SELECT
  schemaname,
  tablename,
  CASE relreplident
    WHEN 'd' THEN 'default (primary key)'
    WHEN 'f' THEN 'FULL (all columns) ✅'
    WHEN 'i' THEN 'index'
    WHEN 'n' THEN 'nothing'
  END as replica_identity
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE relname = 'messages'
  AND schemaname = 'public';

-- Step 7: Check RLS policies (must allow SELECT)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY cmd;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================
SELECT
  'messages' as table_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename = 'messages'
    )
    THEN '✅ ENABLED in publication'
    ELSE '❌ NOT in publication'
  END as publication_status,
  (SELECT CASE relreplident
    WHEN 'f' THEN '✅ FULL'
    ELSE '❌ NOT FULL (' || relreplident || ')'
  END
  FROM pg_class
  WHERE relname = 'messages') as replica_identity;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT '✅ Execute the verification query above. Both should show ✅' as instruction;
