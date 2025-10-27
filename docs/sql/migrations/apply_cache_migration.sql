-- Apply search_cache migration manually
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ujigyazketblwlzcomve/editor

-- Create search_cache table for caching external API results
CREATE TABLE IF NOT EXISTS search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  search_type text NOT NULL,
  params jsonb NOT NULL,
  results jsonb NOT NULL,
  tenant_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '24 hours'),
  hit_count integer DEFAULT 0
);

-- Index for fast lookups by cache_key (without WHERE clause to avoid immutability issue)
CREATE INDEX IF NOT EXISTS idx_search_cache_key ON search_cache(cache_key);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

-- Index for analytics by type and tenant
CREATE INDEX IF NOT EXISTS idx_search_cache_type_tenant ON search_cache(search_type, tenant_id, created_at);

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM search_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read cache from their tenant" ON search_cache;
DROP POLICY IF EXISTS "Service role has full access" ON search_cache;

-- Policy: Service role can do everything (for Edge Functions)
CREATE POLICY "Service role has full access"
  ON search_cache
  FOR ALL
  USING (true);

-- Verify table was created
SELECT 'Migration applied successfully!' as status;
SELECT tablename FROM pg_tables WHERE tablename = 'search_cache';
