-- Apply search_jobs migration for async search processing
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ujigyazketblwlzcomve/editor

-- Create search_jobs table for async search processing
CREATE TABLE IF NOT EXISTS search_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  search_type text NOT NULL,
  provider text NOT NULL,
  params jsonb NOT NULL,
  status text DEFAULT 'pending',
  results jsonb,
  error text,
  cache_hit boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_jobs_conversation ON search_jobs(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_jobs_status ON search_jobs(status, created_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_search_jobs_lookup ON search_jobs(id, status);

-- Enable RLS
ALTER TABLE search_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their search jobs" ON search_jobs;
DROP POLICY IF EXISTS "Service role has full access to search jobs" ON search_jobs;

-- Policy: Service role has full access (for Edge Functions)
CREATE POLICY "Service role has full access to search jobs"
  ON search_jobs
  FOR ALL
  USING (true);

-- Function to cleanup old completed jobs
CREATE OR REPLACE FUNCTION cleanup_old_search_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM search_jobs
  WHERE status = 'completed'
  AND completed_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify table was created
SELECT 'Async migration applied successfully!' as status;
SELECT tablename FROM pg_tables WHERE tablename = 'search_jobs';
