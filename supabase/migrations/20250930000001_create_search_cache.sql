-- Create search_cache table for caching external API results
CREATE TABLE IF NOT EXISTS search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  search_type text NOT NULL, -- 'hotel_search', 'flight_search', 'package_search'
  params jsonb NOT NULL,
  results jsonb NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '24 hours'),
  hit_count integer DEFAULT 0
);

-- Index for fast lookups by cache_key
CREATE INDEX idx_search_cache_key ON search_cache(cache_key) WHERE expires_at > now();

-- Index for cleanup of expired entries
CREATE INDEX idx_search_cache_expires ON search_cache(expires_at);

-- Index for analytics by type and tenant
CREATE INDEX idx_search_cache_type_tenant ON search_cache(search_type, tenant_id, created_at);

-- Function to clean expired cache entries (run daily via cron)
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM search_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read cache from their tenant
CREATE POLICY "Users can read cache from their tenant"
  ON search_cache
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM agency WHERE id IN (
        SELECT agency_id FROM "user" WHERE id = auth.uid()
      )
    )
  );

-- Policy: Service role can do everything (for Edge Functions)
CREATE POLICY "Service role has full access"
  ON search_cache
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
