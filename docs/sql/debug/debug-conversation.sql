-- Debug: Check the last created conversation
SELECT
  id,
  created_by,
  agency_id,
  tenant_id,
  channel,
  state,
  created_at,
  external_key
FROM public.conversations
ORDER BY created_at DESC
LIMIT 5;

-- Check if the seller can see the conversation they created
-- Run this query AS the seller user (using their JWT token)
-- Or check the policy result:
SELECT
  c.id,
  c.created_by,
  c.external_key,
  c.created_at,
  u.email as creator_email,
  CASE
    WHEN c.created_by = 'cbe414c2-4131-4c19-a920-e27764b27488'::uuid THEN 'YES - Seller owns this'
    ELSE 'NO - Seller does NOT own this'
  END as seller_can_see
FROM public.conversations c
LEFT JOIN public.users u ON c.created_by = u.id
ORDER BY c.created_at DESC
LIMIT 5;

-- Check the RLS policy
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'conversations'
AND policyname IN ('conversations_select_policy', 'conversations_insert_policy')
ORDER BY policyname;
