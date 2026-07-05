-- =====================================================
-- Migration: Create API Usage Events
-- Description: Immutable ledger for authenticated public API usage.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.api_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_id TEXT,
  correlation_id TEXT,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  cached BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT api_usage_events_status_code_check CHECK (status_code BETWEEN 100 AND 599),
  CONSTRAINT api_usage_events_duration_ms_check CHECK (duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_events_api_key_created
  ON public.api_usage_events(api_key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_events_agency_created
  ON public.api_usage_events(agency_id, created_at DESC)
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_usage_events_tenant_created
  ON public.api_usage_events(tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_usage_events_endpoint_created
  ON public.api_usage_events(endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_events_request_id
  ON public.api_usage_events(request_id)
  WHERE request_id IS NOT NULL;

COMMENT ON TABLE public.api_usage_events IS 'Ledger de requests autenticadas al Public API Gateway';
COMMENT ON COLUMN public.api_usage_events.api_key_id IS 'API key autenticada que originó el request';
COMMENT ON COLUMN public.api_usage_events.endpoint IS 'Path normalizado del endpoint invocado';
COMMENT ON COLUMN public.api_usage_events.cached IS 'Indica si la respuesta salió del cache de idempotencia';
COMMENT ON COLUMN public.api_usage_events.metadata IS 'Metadata no sensible para auditoría operativa';

ALTER TABLE public.api_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "API usage accessible solo por service role"
  ON public.api_usage_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "API usage visible solo para OWNER y SUPERADMIN"
  ON public.api_usage_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('OWNER', 'SUPERADMIN')
      AND (
        users.tenant_id = api_usage_events.tenant_id
        OR users.role = 'OWNER'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.increment_api_key_usage_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.api_keys
  SET
    usage_count = COALESCE(usage_count, 0) + 1,
    last_used_at = GREATEST(COALESCE(last_used_at, '-infinity'::timestamptz), NEW.created_at)
  WHERE id = NEW.api_key_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS api_usage_events_increment_key_usage ON public.api_usage_events;

CREATE TRIGGER api_usage_events_increment_key_usage
  AFTER INSERT ON public.api_usage_events
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_api_key_usage_from_event();
