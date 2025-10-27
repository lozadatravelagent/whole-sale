-- ============================================================
-- DEBUG: Check seller permissions and data
-- ============================================================

-- 1. Check the seller user data
SELECT
  id,
  email,
  role,
  agency_id,
  tenant_id,
  name,
  created_at
FROM public.users
WHERE email = 'seller@seller.com';

-- 2. Check if agency exists for this seller
SELECT
  u.email,
  u.role,
  u.agency_id,
  u.tenant_id,
  a.name as agency_name,
  a.status as agency_status,
  t.name as tenant_name
FROM public.users u
LEFT JOIN public.agencies a ON u.agency_id = a.id
LEFT JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.email = 'seller@seller.com';

-- 3. Check the conversation being accessed
SELECT
  c.id,
  c.agency_id,
  c.tenant_id,
  c.channel,
  c.state,
  a.name as agency_name
FROM public.conversations c
LEFT JOIN public.agencies a ON c.agency_id = a.id
WHERE c.id = '023ae14e-f585-48c4-bdf8-2d081f484d1b';

-- 4. Check helper function results for this seller
-- (Run this as the seller user to see what the functions return)
-- Note: These functions use auth.uid(), so they need to be run in authenticated context

-- 5. Verify the current messages_insert_policy exists
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'messages'
AND policyname = 'messages_insert_policy';

-- 6. Check all conversations for the seller's agency
SELECT
  c.id,
  c.agency_id,
  c.external_key,
  c.channel,
  COUNT(m.id) as message_count
FROM public.conversations c
LEFT JOIN public.messages m ON m.conversation_id = c.id
WHERE c.agency_id = (
  SELECT agency_id FROM public.users WHERE email = 'seller@seller.com'
)
GROUP BY c.id, c.agency_id, c.external_key, c.channel
ORDER BY c.created_at DESC
LIMIT 10;
