-- Rate limiting configuration tables
-- This provides application-level rate limiting per user/tenant

-- Table to store rate limit configuration by tenant/plan
CREATE TABLE IF NOT EXISTS rate_limit_config (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  plan_type text DEFAULT 'free', -- 'free', 'pro', 'enterprise'

  -- Search limits (más generosos)
  max_searches_per_hour integer DEFAULT 100,   -- Aumentado de 10 a 100
  max_searches_per_day integer DEFAULT 500,    -- Aumentado de 50 a 500

  -- Message/chat limits (más generosos)
  max_messages_per_hour integer DEFAULT 200,   -- Aumentado de 20 a 200
  max_messages_per_day integer DEFAULT 1000,   -- Aumentado de 100 a 1000

  -- API call limits (para servicios externos)
  max_api_calls_per_hour integer DEFAULT 150,  -- Aumentado de 30 a 150

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Table to track actual usage
CREATE TABLE IF NOT EXISTS rate_limit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'search', 'message', 'api_call'
  resource text, -- Optional: specific resource like 'flight_search', 'hotel_search'

  -- Tracking
  request_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  window_end timestamp with time zone,

  -- Metadata
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_usage_user_action ON rate_limit_usage(user_id, action, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_usage_tenant_action ON rate_limit_usage(tenant_id, action, window_start);
-- Index without predicate to avoid IMMUTABLE issue
CREATE INDEX IF NOT EXISTS idx_rate_limit_usage_window ON rate_limit_usage(window_start);

-- Function to check if user is within rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_tenant_id uuid,
  p_action text,
  p_window_minutes integer DEFAULT 60
) RETURNS jsonb AS $$
DECLARE
  v_config record;
  v_limit integer;
  v_count integer;
  v_window_start timestamp;
BEGIN
  -- Calculate window start
  v_window_start := now() - (p_window_minutes || ' minutes')::interval;

  -- Get tenant config (create default if not exists)
  SELECT * INTO v_config
  FROM rate_limit_config
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    -- Insert default config for tenant
    INSERT INTO rate_limit_config (tenant_id)
    VALUES (p_tenant_id)
    RETURNING * INTO v_config;
  END IF;

  -- Determine limit based on action and window
  CASE
    WHEN p_action = 'search' AND p_window_minutes = 60 THEN
      v_limit := v_config.max_searches_per_hour;
    WHEN p_action = 'search' AND p_window_minutes = 1440 THEN
      v_limit := v_config.max_searches_per_day;
    WHEN p_action = 'message' AND p_window_minutes = 60 THEN
      v_limit := v_config.max_messages_per_hour;
    WHEN p_action = 'message' AND p_window_minutes = 1440 THEN
      v_limit := v_config.max_messages_per_day;
    WHEN p_action = 'api_call' AND p_window_minutes = 60 THEN
      v_limit := v_config.max_api_calls_per_hour;
    ELSE
      v_limit := 10; -- Default fallback
  END CASE;

  -- Count requests in window
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM rate_limit_usage
  WHERE user_id = p_user_id
    AND action = p_action
    AND window_start >= v_window_start;

  -- Return result
  RETURN jsonb_build_object(
    'allowed', v_count < v_limit,
    'limit', v_limit,
    'current', v_count,
    'remaining', GREATEST(0, v_limit - v_count),
    'reset_at', v_window_start + (p_window_minutes || ' minutes')::interval
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record rate limit usage
CREATE OR REPLACE FUNCTION record_rate_limit_usage(
  p_user_id uuid,
  p_tenant_id uuid,
  p_action text,
  p_resource text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO rate_limit_usage (
    user_id,
    tenant_id,
    action,
    resource,
    window_start
  ) VALUES (
    p_user_id,
    p_tenant_id,
    p_action,
    p_resource,
    date_trunc('hour', now()) -- Round to hour for aggregation
  )
  ON CONFLICT DO NOTHING; -- If exists in this hour, don't duplicate

  -- Increment count if already exists in this hour
  UPDATE rate_limit_usage
  SET request_count = request_count + 1
  WHERE user_id = p_user_id
    AND action = p_action
    AND window_start = date_trunc('hour', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old usage records (run via cron)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_usage()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_usage
  WHERE window_start < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_usage ENABLE ROW LEVEL SECURITY;

-- Policies for rate_limit_config
CREATE POLICY "Admins can manage rate limit config"
  ON rate_limit_config
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM agencies WHERE id IN (
        SELECT agency_id FROM users WHERE id = auth.uid() AND role = 'ADMIN'
      )
    )
  );

CREATE POLICY "Service role has full access to rate config"
  ON rate_limit_config
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policies for rate_limit_usage
CREATE POLICY "Users can view their own usage"
  ON rate_limit_usage
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role has full access to rate usage"
  ON rate_limit_usage
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Insert default config for existing tenants
INSERT INTO rate_limit_config (tenant_id, plan_type)
SELECT id, 'free'
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Success message
SELECT 'Rate limiting tables and functions created successfully!' as status;
