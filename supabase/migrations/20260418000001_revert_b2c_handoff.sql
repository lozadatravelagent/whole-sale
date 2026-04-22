-- ============================================================
-- PR 4 — Revert B2C Handoff Leads
-- Date: 2026-04-18
--
-- Reverses 20260411000001_b2c_handoff_leads.sql. The human-handoff
-- flow that let consumers submit leads from the Emilia companion
-- chat has been removed from the product in PR 4; this migration
-- restores the leads table to its pre-handoff B2B-only shape.
--
-- Pre-check: confirmed via
--   SELECT count(*) FROM leads WHERE agency_id IS NULL;
-- against production returned 0 (no orphan consumer-originated
-- leads to reassign), so the NOT NULL reinstatement is safe.
--
-- Nothing in 20260411000002_consumer_conversations_rls.sql is
-- handoff-specific — that migration adds consumer_insert_own_
-- conversations, which is required by the B2C chat surface that
-- survives PR 4. It is intentionally NOT reverted.
--
-- Rollback (re-apply 20260411000001):
--   - Re-run 20260411000001_b2c_handoff_leads.sql or run this file
--     in reverse order.
-- ============================================================


-- ============================================================
-- SECTION 1: Drop consumer handoff RLS policy
-- ============================================================
DROP POLICY IF EXISTS "consumer_insert_handoff_leads" ON public.leads;


-- ============================================================
-- SECTION 2: Drop B2C inbox indexes
-- ============================================================
DROP INDEX IF EXISTS public.idx_leads_b2c_inbox;
DROP INDEX IF EXISTS public.idx_leads_trip_id;


-- ============================================================
-- SECTION 3: Drop leads.trip_id column
-- ============================================================
ALTER TABLE public.leads DROP COLUMN IF EXISTS trip_id;


-- ============================================================
-- SECTION 4: Restore NOT NULL on agency_id / tenant_id
-- ============================================================
-- Safe because production pre-check confirmed zero rows with
-- agency_id IS NULL. If the migration is applied to an environment
-- where consumer-originated leads exist, the ALTER will fail —
-- that is intentional (forces explicit reassignment).
ALTER TABLE public.leads ALTER COLUMN agency_id SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN tenant_id SET NOT NULL;


-- ============================================================
-- SECTION 5: Restore CASCADE FKs (pre-B2C behavior)
-- ============================================================
-- 20260411000001 converted these from CASCADE to SET NULL so that
-- deleting an agency/tenant would null out the column on orphan
-- consumer leads. With NOT NULL restored, SET NULL is no longer
-- valid; return to the original CASCADE semantics.

DO $$
DECLARE fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'leads'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'agency_id';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_agency_id_fkey
  FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;

DO $$
DECLARE fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'leads'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id';
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
