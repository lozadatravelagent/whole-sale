-- =====================================================
-- Migration: Create API Request Cache Table
-- Description: Tabla para idempotencia de requests con TTL 5 minutos
-- Date: 2025-12-08
-- =====================================================

-- Create api_request_cache table
CREATE TABLE IF NOT EXISTS api_request_cache (
  request_id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL,
  response_data JSONB NOT NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_request_cache_expires ON api_request_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_request_cache_api_key ON api_request_cache(api_key_id);
CREATE INDEX IF NOT EXISTS idx_request_cache_created_at ON api_request_cache(created_at);

-- Add comments for documentation
COMMENT ON TABLE api_request_cache IS 'Cache de requests para idempotencia (TTL 5 minutos)';
COMMENT ON COLUMN api_request_cache.request_id IS 'UUID generado por el cliente para idempotencia';
COMMENT ON COLUMN api_request_cache.search_id IS 'ID de búsqueda generado por el servidor';
COMMENT ON COLUMN api_request_cache.response_data IS 'Response completa en formato JSON';
COMMENT ON COLUMN api_request_cache.expires_at IS 'Timestamp de expiración (5 minutos desde creación)';

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_request_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM api_request_cache WHERE expires_at < NOW();

  -- Log cleanup for monitoring
  RAISE NOTICE 'Cleaned up expired request cache entries at %', NOW();
END;
$$;

COMMENT ON FUNCTION cleanup_expired_request_cache() IS 'Elimina entradas expiradas de api_request_cache (ejecutar cada hora vía cron)';

-- Create a scheduled job to run cleanup every hour (requires pg_cron extension)
-- Note: This assumes pg_cron is already enabled in Supabase
-- If not, this section will be skipped and cleanup should be done manually or via external cron

DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule cleanup job to run every hour
    PERFORM cron.schedule(
      'cleanup-api-request-cache',  -- Job name
      '0 * * * *',                   -- Cron schedule: every hour at minute 0
      $$SELECT cleanup_expired_request_cache()$$
    );

    RAISE NOTICE 'Scheduled cleanup job for api_request_cache';
  ELSE
    RAISE NOTICE 'pg_cron extension not found. Cleanup must be scheduled externally.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cleanup job: %. Manual cleanup required.', SQLERRM;
END;
$$;

-- Enable Row Level Security (RLS)
ALTER TABLE api_request_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Cache entries are accessible only by the Edge Functions (service role)
-- No direct access from client applications
CREATE POLICY "Cache accessible solo por service role"
  ON api_request_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- Alternative policy if we need to allow API key owners to see their cache
-- (Comentado por ahora - descomentar si se necesita)
-- CREATE POLICY "Cache visible para dueños de API key"
--   ON api_request_cache
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM api_keys
--       WHERE api_keys.id = api_request_cache.api_key_id
--       AND EXISTS (
--         SELECT 1 FROM users
--         WHERE users.id = auth.uid()
--         AND users.role IN ('OWNER', 'SUPERADMIN')
--         AND (
--           users.tenant_id = api_keys.tenant_id
--           OR users.role = 'OWNER'
--         )
--       )
--     )
--   );
