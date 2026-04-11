-- ============================================================
-- Fix: allow consumers to INSERT conversations
-- Date: 2026-04-11
--
-- Bug: after Paso 4 (consumer auth) landed, a consumer hitting
-- /emilia/chat for the first time could not create a conversation.
-- Two layers were failing:
--
--   1. Client-side check in src/hooks/useChat.ts threw
--      "User has no agency assigned" because canHaveNullAgency
--      didn't include 'CONSUMER'. Fixed in this PR alongside
--      this migration.
--
--   2. The existing conversations_insert_policy (from
--      20260309000001_rls_use_jwt_claims.sql) required
--      `agency_id = public.get_user_agency_id()`. For a consumer
--      both sides are NULL, and Postgres evaluates NULL = NULL as
--      NULL, treated as FALSE inside WITH CHECK — so the insert is
--      silently rejected at the DB layer.
--
-- Fix strategy: add an additive policy dedicated to consumers.
-- The existing B2B conversations_insert_policy is NOT touched
-- (agents keep passing through it unchanged). Pattern matches the
-- consumer-specific policies added in Paso 1.1.a (trips) and
-- Paso 2 (leads):
--   - consumer_insert_own_trips
--   - consumer_update_own_trips
--   - consumer_insert_handoff_leads
--
-- Postgres RLS for INSERT: the row must satisfy WITH CHECK of at
-- least one policy. Agents satisfy conversations_insert_policy;
-- consumers satisfy this new one. The two do not overlap because
-- the new policy gates on get_user_account_type() = 'consumer'.
--
-- Not touched by this migration:
--   - conversations_insert_policy (existing B2B path)
--   - conversations_select_policy (already filters by created_by,
--     which works for consumers as-is)
--   - conversations_update_policy (untouched, out of scope for
--     this bug)
--   - trips / leads / messages policies
--
-- Rollback:
--   DROP POLICY IF EXISTS "consumer_insert_own_conversations"
--     ON public.conversations;
-- ============================================================

DROP POLICY IF EXISTS "consumer_insert_own_conversations" ON public.conversations;

CREATE POLICY "consumer_insert_own_conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_account_type() = 'consumer'
    AND created_by = auth.uid()
    AND agency_id IS NULL
    AND tenant_id IS NULL
  );

COMMENT ON POLICY "consumer_insert_own_conversations" ON public.conversations IS
  'B2C: consumers (account_type=consumer) can create conversations they own (created_by=auth.uid) with null agency_id/tenant_id. Additive to conversations_insert_policy which still gates the agent path.';
