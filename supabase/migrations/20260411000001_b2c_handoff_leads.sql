-- ============================================================
-- Paso 2 — B2C Handoff Leads
-- Date: 2026-04-11
--
-- Enables consumers to submit human-handoff lead requests from
-- the Emilia companion chat. Before this migration, leads were
-- B2B-only: agency_id and tenant_id were NOT NULL, and the
-- leads_insert_policy required agency_id = get_user_agency_id()
-- (which fails for consumers who have no agency).
--
-- This migration:
--   1. Relaxes agency_id / tenant_id NOT NULL → NULLABLE, FK to
--      ON DELETE SET NULL. Consumer-originated leads will carry
--      NULL for both, identifying them as the "B2C inbox".
--   2. Adds leads.trip_id UUID FK to trips(id) ON DELETE SET NULL
--      for explicit linkage (symmetric to trips.lead_id which
--      already exists for the reverse direction).
--   3. Adds indexes for common B2C inbox queries.
--   4. Adds a new RLS policy consumer_insert_handoff_leads that
--      permits a consumer (account_type = 'consumer') to insert a
--      lead only when:
--        - conversation_id points to a conversation they created
--        - agency_id / tenant_id / assigned_user_id are all NULL
--   5. Existing B2B policies (leads_insert_policy, leads_select_
--      policy, leads_update_policy) remain untouched and continue
--      to gate agent behavior.
--
-- Rollback (in reverse order):
--   - DROP POLICY "consumer_insert_handoff_leads" ON leads;
--   - DROP INDEX IF EXISTS idx_leads_b2c_inbox;
--   - DROP INDEX IF EXISTS idx_leads_trip_id;
--   - ALTER TABLE leads DROP COLUMN IF EXISTS trip_id;
--   - ALTER TABLE leads ALTER COLUMN tenant_id SET NOT NULL;  -- data loss risk
--   - ALTER TABLE leads ALTER COLUMN agency_id SET NOT NULL;  -- data loss risk
--   - Restore CASCADE FKs.
-- ============================================================


-- ============================================================
-- SECTION 1: Relax agency_id / tenant_id NOT NULL
-- ============================================================
ALTER TABLE public.leads ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN tenant_id DROP NOT NULL;


-- ============================================================
-- SECTION 2: Change FK cascade behavior (CASCADE → SET NULL)
-- ============================================================
-- Dynamic name lookup because constraint auto-naming varies.

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
  FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;

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
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;


-- ============================================================
-- SECTION 3: Add leads.trip_id FK to trips
-- ============================================================
-- Symmetric to the existing trips.lead_id column. Consumer
-- handoffs will populate this so the CRM can display the trip
-- context alongside the lead.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS trip_id UUID
    REFERENCES public.trips(id) ON DELETE SET NULL;


-- ============================================================
-- SECTION 4: Indexes for B2C inbox
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leads_trip_id
  ON public.leads(trip_id);

-- Partial index: fast listing of B2C handoff leads awaiting assignment.
CREATE INDEX IF NOT EXISTS idx_leads_b2c_inbox
  ON public.leads(created_at DESC)
  WHERE agency_id IS NULL AND status = 'new';


-- ============================================================
-- SECTION 5: Consumer INSERT policy
-- ============================================================
-- Allows a consumer user to insert a lead only when:
--   - account_type is 'consumer' (defense in depth against
--     mis-classified users)
--   - the referenced conversation exists and was created by the
--     same user (ownership check via conversations.created_by)
--   - agency_id, tenant_id, assigned_user_id are all NULL
--     (B2C handoffs do not belong to any agency/tenant until an
--     agent claims them from the inbox)
--
-- The existing leads_insert_policy continues to gate agent
-- behavior; neither policy shadows the other because the
-- consumer path requires account_type='consumer' while the agent
-- path requires a non-null agency match.
--
-- Rollback:
--   DROP POLICY IF EXISTS "consumer_insert_handoff_leads" ON public.leads;
-- ============================================================

DROP POLICY IF EXISTS "consumer_insert_handoff_leads" ON public.leads;

CREATE POLICY "consumer_insert_handoff_leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_account_type() = 'consumer'
    AND agency_id IS NULL
    AND tenant_id IS NULL
    AND assigned_user_id IS NULL
    AND conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = leads.conversation_id
        AND conversations.created_by = auth.uid()
    )
  );
