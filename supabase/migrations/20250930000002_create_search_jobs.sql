-- Create search_jobs table for async search processing
CREATE TABLE IF NOT EXISTS search_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  search_type text NOT NULL, -- 'searchFlights', 'searchHotels', 'searchPackages', 'searchServices'
  provider text NOT NULL, -- 'TVC', 'EUROVIPS'
  params jsonb NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  results jsonb,
  error text,
  cache_hit boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Indexes for performance
DROP INDEX IF EXISTS idx_search_jobs_conversation;
CREATE INDEX idx_search_jobs_conversation ON search_jobs(conversation_id, created_at DESC);

DROP INDEX IF EXISTS idx_search_jobs_status;
CREATE INDEX idx_search_jobs_status ON search_jobs(status, created_at) WHERE status IN ('pending', 'processing');

DROP INDEX IF EXISTS idx_search_jobs_lookup;
CREATE INDEX idx_search_jobs_lookup ON search_jobs(id, status);

-- Enable RLS
ALTER TABLE search_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read jobs from their conversations
DROP POLICY IF EXISTS "Users can read their search jobs" ON search_jobs;
CREATE POLICY "Users can read their search jobs"
  ON search_jobs
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN leads l ON l.conversation_id = c.id
      JOIN agencies a ON a.id = l.agency_id
      JOIN users u ON u.agency_id = a.id
      WHERE u.id = auth.uid()
    )
  );

-- Policy: Service role has full access (for Edge Functions)
DROP POLICY IF EXISTS "Service role has full access to search jobs" ON search_jobs;
CREATE POLICY "Service role has full access to search jobs"
  ON search_jobs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to cleanup old completed jobs (run via cron)
CREATE OR REPLACE FUNCTION cleanup_old_search_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM search_jobs
  WHERE status = 'completed'
  AND completed_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
