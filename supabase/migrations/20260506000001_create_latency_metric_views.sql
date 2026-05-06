-- ============================================================
-- Migration: Emilia latency metric views
-- Date: 2026-05-06
--
-- Purpose: expose p50/p95 latency by runtime stage without bypassing RLS.
-- Views use security_invoker so tenant/agency access is enforced by the
-- underlying table policies.
-- ============================================================

CREATE OR REPLACE VIEW public.agent_run_latency_metrics
WITH (security_invoker = true) AS
SELECT
  agency_id,
  date_trunc('hour', created_at) AS bucket_hour,
  event_type,
  COALESCE(tool_name, event_type) AS stage,
  COUNT(*)::INTEGER AS sample_count,
  ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms))::INTEGER AS p50_latency_ms,
  ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))::INTEGER AS p95_latency_ms,
  ROUND(AVG(latency_ms))::INTEGER AS avg_latency_ms,
  MAX(latency_ms)::INTEGER AS max_latency_ms,
  COUNT(*) FILTER (WHERE status <> 'ok' OR error IS NOT NULL)::INTEGER AS error_count,
  MIN(created_at) AS first_seen_at,
  MAX(created_at) AS last_seen_at
FROM public.agent_run_events
WHERE latency_ms IS NOT NULL
GROUP BY
  agency_id,
  date_trunc('hour', created_at),
  event_type,
  COALESCE(tool_name, event_type);

CREATE OR REPLACE VIEW public.llm_request_latency_metrics
WITH (security_invoker = true) AS
SELECT
  tenant_id,
  agency_id,
  date_trunc('hour', created_at) AS bucket_hour,
  feature,
  operation,
  model,
  COUNT(*)::INTEGER AS sample_count,
  ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms))::INTEGER AS p50_latency_ms,
  ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))::INTEGER AS p95_latency_ms,
  ROUND(AVG(latency_ms))::INTEGER AS avg_latency_ms,
  MAX(latency_ms)::INTEGER AS max_latency_ms,
  COUNT(*) FILTER (WHERE success IS FALSE)::INTEGER AS error_count,
  MIN(created_at) AS first_seen_at,
  MAX(created_at) AS last_seen_at
FROM public.llm_request_logs
WHERE latency_ms IS NOT NULL
GROUP BY
  tenant_id,
  agency_id,
  date_trunc('hour', created_at),
  feature,
  operation,
  model;

COMMENT ON VIEW public.agent_run_latency_metrics IS
  'Hourly p50/p95 latency by Emilia runtime stage from agent_run_events.';

COMMENT ON VIEW public.llm_request_latency_metrics IS
  'Hourly p50/p95 latency by LLM feature, operation, and model from llm_request_logs.';
