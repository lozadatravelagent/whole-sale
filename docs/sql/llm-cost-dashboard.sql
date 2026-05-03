-- ============================================================================
-- LLM Cost & Cache Dashboard
-- Target table: public.llm_request_logs
-- Schema: supabase/migrations/20260425000001_llm_knowledge_and_usage.sql
--
-- Use: Copy a single named block into Supabase SQL Editor or psql.
--
-- RLS posture: SELECT is scoped by role.
--   - OWNER       → all rows
--   - SUPERADMIN  → own tenant only
--   - ADMIN       → own agency only
--   - SELLER      → no access
-- For global analytics (cross-agency totals, hit-rate trends), RUN AS
-- service_role (Supabase SQL Editor uses this by default for project owners).
-- For per-agency operator dashboards, run as the authenticated user — RLS
-- auto-scopes the result set.
--
-- Background — what these queries are designed to monitor:
--   - Prompt caching enabled in commit b7ac8fcb (cached_tokens populated for
--     every cache-hit request).
--   - historyWindow raised 6 → 15 in commit 85f2aada (more conversation
--     history → larger prompt_tokens; cached_tokens should rise proportionally
--     if caching is engaging).
--   - Pricing: cached input is ~10x cheaper than fresh on GPT-5 models, ~4x
--     cheaper on GPT-4.1 (see supabase/functions/_shared/llm/pricing.ts).
--     `estimated_cost_usd` already reflects the post-cache discount — do NOT
--     subtract cached_tokens again from cost.
--
-- Notes on query shape:
--   - All time windows use `created_at >= NOW() - INTERVAL '...'` to hit the
--     index `idx_llm_request_logs_created_at` (and the composite tenant
--     index when filtering by agency).
--   - Every denominator is wrapped in NULLIF(x, 0) to avoid div-by-zero.
--   - Most queries filter `success = true` so error responses don't skew
--     latency/cost averages. Override by removing the filter if you want a
--     full picture including failures.
-- ============================================================================


-- 1) cache_hit_rate_by_hour --------------------------------------------------
-- Purpose: Hourly cache-hit trend over the last 24h, broken down by feature.
--          Use immediately after a prompt-caching deploy to confirm hits are
--          climbing (typically 0% → 60-80% within a few hours as conversations
--          warm up the cache). A flat 0% means the static prefix is being
--          mutated per-turn — investigate prompt.ts for accidental dynamic
--          interpolation in STATIC_SYSTEM_PROMPT.
-- Expected output columns: hour, feature, requests, prompt_tokens,
--          cached_tokens, hit_rate_pct
-- Tunable: change INTERVAL '24 hours' to widen the window.
SELECT
  date_trunc('hour', created_at)              AS hour,
  feature,
  COUNT(*)                                    AS requests,
  SUM(prompt_tokens)                          AS prompt_tokens,
  SUM(cached_tokens)                          AS cached_tokens,
  ROUND(
    100.0 * SUM(cached_tokens) / NULLIF(SUM(prompt_tokens), 0),
    1
  )                                           AS hit_rate_pct
FROM public.llm_request_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND success = true
  AND prompt_tokens IS NOT NULL
GROUP BY 1, 2
ORDER BY hour DESC, feature;


-- 2) cache_hit_rate_overall --------------------------------------------------
-- Purpose: 7-day rollup per feature with hit rate AND latency percentiles.
--          The latency columns help confirm that cache hits are also delivering
--          a TTFT win (usually 100-400ms shaved off p95 on cached prompts).
-- Expected output columns: feature, requests, prompt_tokens, cached_tokens,
--          hit_rate_pct, p50_latency_ms, p95_latency_ms
-- Tunable: change INTERVAL '7 days'.
SELECT
  feature,
  COUNT(*)                                    AS requests,
  SUM(prompt_tokens)                          AS prompt_tokens,
  SUM(cached_tokens)                          AS cached_tokens,
  ROUND(
    100.0 * SUM(cached_tokens) / NULLIF(SUM(prompt_tokens), 0),
    1
  )                                           AS hit_rate_pct,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms))::int AS p50_latency_ms,
  ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))::int AS p95_latency_ms
FROM public.llm_request_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND success = true
  AND prompt_tokens IS NOT NULL
GROUP BY feature
ORDER BY requests DESC;


-- 3) cost_per_feature_last_30d -----------------------------------------------
-- Purpose: 30-day cost rollup grouped by (feature, model, operation). Useful
--          for spotting which surface area drives spend AND whether a specific
--          model/operation is unexpectedly expensive (e.g. tool-loop spinning
--          on iterationCap).
-- Expected output columns: feature, model, operation, requests, total_cost_usd,
--          avg_cost_per_request_usd, total_prompt_tokens, total_completion_tokens
SELECT
  feature,
  model,
  operation,
  COUNT(*)                                    AS requests,
  ROUND(SUM(estimated_cost_usd)::numeric, 4)  AS total_cost_usd,
  ROUND(
    (SUM(estimated_cost_usd) / NULLIF(COUNT(*), 0))::numeric,
    6
  )                                           AS avg_cost_per_request_usd,
  SUM(prompt_tokens)                          AS total_prompt_tokens,
  SUM(completion_tokens)                      AS total_completion_tokens
FROM public.llm_request_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND success = true
GROUP BY feature, model, operation
ORDER BY total_cost_usd DESC;


-- 4) cost_per_agency_last_30d ------------------------------------------------
-- Purpose: Top 20 agencies by 30-day spend with feature breakdown. Useful for
--          internal cost allocation, billing, and spotting an agency that
--          suddenly becomes a large cost center (potential abuse or new
--          high-volume integration).
-- Expected output columns: agency_id, requests, total_cost_usd,
--          feature_breakdown_jsonb (per-feature request count + cost)
-- Tunable: LIMIT 20 → adjust as needed.
WITH per_agency_feature AS (
  SELECT
    agency_id,
    feature,
    COUNT(*)                                  AS feature_requests,
    SUM(estimated_cost_usd)                   AS feature_cost_usd
  FROM public.llm_request_logs
  WHERE created_at >= NOW() - INTERVAL '30 days'
    AND success = true
    AND agency_id IS NOT NULL
  GROUP BY agency_id, feature
)
SELECT
  agency_id,
  SUM(feature_requests)                       AS requests,
  ROUND(SUM(feature_cost_usd)::numeric, 4)    AS total_cost_usd,
  jsonb_object_agg(
    feature,
    jsonb_build_object(
      'requests', feature_requests,
      'cost_usd', ROUND(feature_cost_usd::numeric, 4)
    )
  )                                           AS feature_breakdown
FROM per_agency_feature
GROUP BY agency_id
ORDER BY total_cost_usd DESC
LIMIT 20;


-- 5) latency_distribution_by_model -------------------------------------------
-- Purpose: 7-day latency distribution per model. Cached prompts should show a
--          measurably lower p50/p95 than uncached. Watch p99 — a regression
--          there often signals a tool-loop hitting iterationCap (3) or a slow
--          downstream provider.
-- Expected output columns: model, requests, p50_ms, p95_ms, p99_ms, max_ms
SELECT
  model,
  COUNT(*)                                    AS requests,
  ROUND(percentile_cont(0.5)  WITHIN GROUP (ORDER BY latency_ms))::int AS p50_ms,
  ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))::int AS p95_ms,
  ROUND(percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms))::int AS p99_ms,
  MAX(latency_ms)                             AS max_ms
FROM public.llm_request_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND success = true
  AND latency_ms IS NOT NULL
GROUP BY model
ORDER BY requests DESC;


-- 6) tokens_per_turn_by_feature ----------------------------------------------
-- Purpose: 7-day token sizing per feature. After the historyWindow 6→15 bump
--          (commit 85f2aada), prompt_tokens should rise on `ai-message-parser`.
--          Verify cached_tokens rises proportionally — otherwise we're paying
--          for the bigger window without the cache discount.
-- Expected output columns: feature, requests, avg_prompt, p50_prompt,
--          p95_prompt, avg_cached, avg_completion, avg_total
SELECT
  feature,
  COUNT(*)                                    AS requests,
  ROUND(AVG(prompt_tokens))::int              AS avg_prompt,
  ROUND(percentile_cont(0.5)  WITHIN GROUP (ORDER BY prompt_tokens))::int AS p50_prompt,
  ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY prompt_tokens))::int AS p95_prompt,
  ROUND(AVG(cached_tokens))::int              AS avg_cached,
  ROUND(AVG(completion_tokens))::int          AS avg_completion,
  ROUND(AVG(total_tokens))::int               AS avg_total
FROM public.llm_request_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND success = true
  AND prompt_tokens IS NOT NULL
GROUP BY feature
ORDER BY requests DESC;


-- 7) prompt_version_comparison -----------------------------------------------
-- Purpose: 30-day A/B comparison across prompt versions. `prompt_version` is
--          NOT a top-level column — it lives in metadata as `promptVersion`
--          (written by ai-message-parser/index.ts when computing the request
--          envelope). Use this to validate that the v6→v7 distillation didn't
--          increase cost-per-turn or hurt latency.
-- Expected output columns: prompt_version, feature, requests, avg_prompt,
--          avg_cached, hit_rate_pct, avg_cost_usd, p95_latency_ms
SELECT
  metadata->>'promptVersion'                  AS prompt_version,
  feature,
  COUNT(*)                                    AS requests,
  ROUND(AVG(prompt_tokens))::int              AS avg_prompt,
  ROUND(AVG(cached_tokens))::int              AS avg_cached,
  ROUND(
    100.0 * SUM(cached_tokens) / NULLIF(SUM(prompt_tokens), 0),
    1
  )                                           AS hit_rate_pct,
  ROUND(AVG(estimated_cost_usd)::numeric, 6)  AS avg_cost_usd,
  ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))::int AS p95_latency_ms
FROM public.llm_request_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND success = true
  AND metadata ? 'promptVersion'
GROUP BY metadata->>'promptVersion', feature
ORDER BY feature, prompt_version;


-- 8) top_finish_reasons ------------------------------------------------------
-- Purpose: 7-day distribution of finish_reason per feature. Healthy mix:
--          mostly `stop` and `tool_calls`. A spike in `length` means responses
--          are getting truncated (max_tokens too low or replies bloated). A
--          spike in `content_filter` or other reasons is a red flag.
-- Expected output columns: feature, finish_reason, count, pct_of_feature
WITH per_feature_total AS (
  SELECT feature, COUNT(*) AS total
  FROM public.llm_request_logs
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY feature
)
SELECT
  l.feature,
  l.finish_reason,
  COUNT(*)                                    AS count,
  ROUND(
    100.0 * COUNT(*) / NULLIF(t.total, 0),
    1
  )                                           AS pct_of_feature
FROM public.llm_request_logs l
JOIN per_feature_total t USING (feature)
WHERE l.created_at >= NOW() - INTERVAL '7 days'
  AND l.finish_reason IS NOT NULL
GROUP BY l.feature, l.finish_reason, t.total
ORDER BY l.feature, count DESC;


-- ============================================================================
-- Recommended monitoring cadence — first 48h post cache + historyWindow deploy
-- ============================================================================
-- Hour 1-2  : Run #1 (cache_hit_rate_by_hour). Confirm hit_rate_pct climbs
--             above 0% on `ai-message-parser`. If still 0% after hour 2, the
--             static prefix is being mutated — check prompt.ts.
-- Day 1     : Run #2 + #5. Hit rate should reach 40-60% on active features.
--             p95 latency on `gpt-4.1-mini` (or current parser model) should
--             drop ~100-400ms vs pre-deploy baseline.
-- Day 2     : Run #6. Verify avg_prompt rose on `ai-message-parser` (history
--             bump effect) AND avg_cached rose proportionally. If avg_prompt
--             rose but avg_cached didn't — caching is not engaging the new
--             content; investigate.
-- Day 7     : Run #3 + #4. Total cost trend should bend down vs the 7 days
--             before the cache deploy, even with the historyWindow bump.
-- Day 30    : Run #7 to confirm v7 prompt is at parity-or-better vs v6 on
--             cost/latency/hit-rate. Also a baseline for future A/Bs.
-- ============================================================================
