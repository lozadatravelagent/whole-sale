-- ============================================================
-- Migration: agent_run_events — append-only Emilia runtime trace
-- Date: 2026-05-05
--
-- Purpose: durable, per-run audit trail for the Context Engineering
-- runtime behind /emilia/chat. This table is append-only from normal
-- app usage; no update/delete policies are granted to authenticated users.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  message_id UUID NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  run_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  tool_name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  latency_ms INTEGER NULL CHECK (latency_ms IS NULL OR latency_ms >= 0),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_conversation_created
  ON public.agent_run_events(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_agency_created
  ON public.agent_run_events(agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_run
  ON public.agent_run_events(run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_tool_errors
  ON public.agent_run_events(tool_name, created_at DESC)
  WHERE error IS NOT NULL;

ALTER TABLE public.agent_run_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_run_events_select_policy" ON public.agent_run_events;
DROP POLICY IF EXISTS "agent_run_events_insert_policy" ON public.agent_run_events;

CREATE POLICY "agent_run_events_select_policy"
  ON public.agent_run_events FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR agency_id = public.get_user_agency_id()
  );

CREATE POLICY "agent_run_events_insert_policy"
  ON public.agent_run_events FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner()
    OR agency_id = public.get_user_agency_id()
  );

COMMENT ON TABLE public.agent_run_events IS
  'Append-only runtime trace for Emilia Context Engineering tool-loop runs.';

COMMENT ON COLUMN public.agent_run_events.run_id IS
  'Per-parser invocation UUID used to correlate parser, tool-loop, tool, memory, and pending-action events.';
