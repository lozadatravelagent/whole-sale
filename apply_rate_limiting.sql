-- Apply rate limiting migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ujigyazketblwlzcomve/editor

-- Copy complete content from: supabase/migrations/20250930000003_rate_limiting.sql

-- This will create:
-- 1. rate_limit_config table (limits per tenant)
-- 2. rate_limit_usage table (usage tracking)
-- 3. check_rate_limit() function
-- 4. record_rate_limit_usage() function
-- 5. cleanup_old_rate_limit_usage() function

-- After running the migration, verify:
SELECT 'Rate limiting system ready!' as status;
SELECT COUNT(*) as tenants_with_config FROM rate_limit_config;
