-- ============================================================================
-- CONVERT role ENUM TO TEXT
-- This fixes the Realtime "mismatch between server and client bindings" error
-- ============================================================================

-- Step 1: Check current data in role column
SELECT role, COUNT(*) as count
FROM messages
GROUP BY role
ORDER BY count DESC;

-- Step 2: Add temporary TEXT column
ALTER TABLE messages ADD COLUMN role_text TEXT;

-- Step 3: Copy data from ENUM to TEXT
UPDATE messages SET role_text = role::text;

-- Step 4: Drop the old ENUM column
ALTER TABLE messages DROP COLUMN role;

-- Step 5: Rename role_text to role
ALTER TABLE messages RENAME COLUMN role_text TO role;

-- Step 6: Add NOT NULL constraint
ALTER TABLE messages ALTER COLUMN role SET NOT NULL;

-- Step 7: Add CHECK constraint to ensure only valid values
ALTER TABLE messages ADD CONSTRAINT messages_role_check
  CHECK (role IN ('user', 'assistant', 'system'));

-- Step 8: Create index for performance
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

-- Step 9: Verify the change
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'messages'
  AND column_name = 'role';

-- Step 10: Check constraint was added
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'messages'::regclass
  AND conname LIKE '%role%';

-- ============================================================================
-- CLEAN UP OLD ENUM TYPE (Optional - only if not used elsewhere)
-- ============================================================================
-- First check if the enum is used in other tables
SELECT
  t.typname as enum_name,
  n.nspname as schema,
  COUNT(a.attname) as column_count
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
LEFT JOIN pg_attribute a ON a.atttypid = t.oid
WHERE t.typname = 'message_role'
GROUP BY t.typname, n.nspname;

-- If column_count = 0, you can safely drop the enum:
-- DROP TYPE IF EXISTS message_role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT '✅ role column converted from ENUM to TEXT with CHECK constraint' as status;
