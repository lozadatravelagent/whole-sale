-- ============================================================================
-- RECONFIGURE REALTIME AFTER ENUM TO TEXT CONVERSION
-- Must be executed after converting role column from ENUM to TEXT
-- ============================================================================

-- Step 1: Remove messages from publication completely
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE messages;
    RAISE NOTICE 'Removed messages from publication';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Table was not in publication';
END $$;

-- Step 2: Wait a moment for the change to propagate
SELECT pg_sleep(1);

-- Step 3: Re-add messages table to publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 4: Set replica identity to FULL
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Step 5: Ensure permissions are correct
GRANT SELECT ON messages TO authenticated;
GRANT SELECT ON messages TO anon;

-- Step 6: Verify the role column is now TEXT (not ENUM)
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'messages'
  AND column_name = 'role';

-- Step 7: Verify publication includes messages
SELECT
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'messages';

-- Step 8: Verify replica identity is FULL
SELECT
  nspname as schema,
  relname as table_name,
  CASE relreplident
    WHEN 'd' THEN 'default (primary key)'
    WHEN 'f' THEN 'FULL (all columns) ✅'
    WHEN 'i' THEN 'index'
    WHEN 'n' THEN 'nothing'
  END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'messages'
  AND n.nspname = 'public';

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
    THEN '✅ In publication'
    ELSE '❌ NOT in publication'
  END as publication_status,
  (SELECT data_type
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'messages'
     AND column_name = 'role') as role_type,
  (SELECT CASE relreplident
    WHEN 'f' THEN '✅ FULL'
    ELSE '❌ NOT FULL'
   END
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relname = 'messages'
     AND n.nspname = 'public'
   LIMIT 1) as replica_identity;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT '✅ Realtime reconfigured. role_type should show "text" (not "USER-DEFINED")' as status;
