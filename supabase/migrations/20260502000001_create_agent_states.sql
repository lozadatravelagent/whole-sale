-- ============================================================
-- Migration: agent_states — EmiliaState persistence (Phase 1.3)
-- Date: 2026-05-02
--
-- Purpose: persist the EmiliaState (Context Engineering layer)
-- per conversation. State is stored as JSONB and is the
-- single source of truth for an Emilia conversation.
--
-- See: docs/architecture/context-engineering-spec.md §1
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_states (
  conversation_id UUID PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant-scoped scans (e.g. consolidate jobs over an agency).
CREATE INDEX IF NOT EXISTS idx_agent_states_agency
  ON public.agent_states(agency_id);

-- Auto-update updated_at on every row mutation.
-- Reuses the existing public.update_updated_at_column() helper
-- (defined in earlier migrations and used by trips, lead_ai_profiles, etc.).
DROP TRIGGER IF EXISTS trg_agent_states_updated_at ON public.agent_states;
CREATE TRIGGER trg_agent_states_updated_at
  BEFORE UPDATE ON public.agent_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS — multi-tenant isolation by agency_id.
--
-- Uses public.get_user_agency_id() (defined in
-- 20260309000001_rls_use_jwt_claims.sql) which reads the JWT
-- claim with a fallback to the users table. is_owner() is
-- granted blanket access (matches the pattern of other tables).
-- ============================================================

ALTER TABLE public.agent_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_states_select_policy" ON public.agent_states;
DROP POLICY IF EXISTS "agent_states_insert_policy" ON public.agent_states;
DROP POLICY IF EXISTS "agent_states_update_policy" ON public.agent_states;
DROP POLICY IF EXISTS "agent_states_delete_policy" ON public.agent_states;

CREATE POLICY "agent_states_select_policy"
  ON public.agent_states FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR agency_id = public.get_user_agency_id()
  );

CREATE POLICY "agent_states_insert_policy"
  ON public.agent_states FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner()
    OR agency_id = public.get_user_agency_id()
  );

CREATE POLICY "agent_states_update_policy"
  ON public.agent_states FOR UPDATE TO authenticated
  USING (
    public.is_owner()
    OR agency_id = public.get_user_agency_id()
  )
  WITH CHECK (
    public.is_owner()
    OR agency_id = public.get_user_agency_id()
  );

CREATE POLICY "agent_states_delete_policy"
  ON public.agent_states FOR DELETE TO authenticated
  USING (
    public.is_owner()
    OR agency_id = public.get_user_agency_id()
  );

-- ============================================================
-- Documentation
-- ============================================================

COMMENT ON TABLE public.agent_states IS
  'Persists the EmiliaState (Context Engineering, Phase 1.3) per conversation. '
  'JSONB shape is documented in src/features/chat/state/emiliaState.ts. '
  'Mutated only via persistence.ts saveEmiliaState(); never bypassed.';

COMMENT ON COLUMN public.agent_states.state IS
  'Full EmiliaState JSON. See docs/architecture/context-engineering-spec.md §1.';

COMMENT ON COLUMN public.agent_states.schema_version IS
  'Bumped on breaking shape changes; loadEmiliaState() validates this and refuses unknown majors.';
