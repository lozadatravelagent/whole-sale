-- ============================================================================
-- CHECK MESSAGES TABLE SCHEMA
-- This will help diagnose the binding mismatch error
-- ============================================================================

-- Check exact column definitions
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- Check if there are any triggers on messages table
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'messages'
  AND event_object_schema = 'public';

-- Check current Realtime publication config
SELECT
  schemaname,
  tablename,
  pubname,
  attnames  -- This shows which columns are included
FROM pg_publication_tables
WHERE tablename = 'messages'
  AND pubname = 'supabase_realtime';

-- Check if there are composite types or JSON columns
SELECT
  c.column_name,
  c.data_type,
  c.udt_name,
  CASE
    WHEN c.data_type = 'USER-DEFINED' THEN t.typname
    ELSE c.data_type
  END as actual_type
FROM information_schema.columns c
LEFT JOIN pg_type t ON t.oid = c.udt_name::regtype
WHERE c.table_schema = 'public'
  AND c.table_name = 'messages'
ORDER BY c.ordinal_position;
