-- Durable, tenant-scoped jobs for asynchronous Emilia API turns.

CREATE TABLE public.emilia_turn_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  conversation_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT NOT NULL DEFAULT 'queued',
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  worker_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  result JSONB,
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  CONSTRAINT emilia_turn_jobs_request_unique UNIQUE (api_key_id, request_id),
  CONSTRAINT emilia_turn_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  CONSTRAINT emilia_turn_jobs_attempt_check
    CHECK (attempt >= 0 AND max_attempts BETWEEN 1 AND 10),
  CONSTRAINT emilia_turn_jobs_payload_hash_check
    CHECK (length(payload_hash) = 64)
);

CREATE INDEX idx_emilia_turn_jobs_claimable
  ON public.emilia_turn_jobs(status, created_at)
  WHERE status IN ('queued', 'processing');

CREATE INDEX idx_emilia_turn_jobs_conversation
  ON public.emilia_turn_jobs(api_key_id, agency_id, conversation_key, created_at)
  WHERE status IN ('queued', 'processing');

CREATE INDEX idx_emilia_turn_jobs_expiry
  ON public.emilia_turn_jobs(expires_at);

ALTER TABLE public.emilia_turn_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emilia_turn_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY "Emilia turn jobs visible within tenant"
  ON public.emilia_turn_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users AS app_user
      WHERE app_user.id = (SELECT auth.uid())
        AND app_user.tenant_id = emilia_turn_jobs.tenant_id
        AND (
          app_user.role IN ('OWNER', 'SUPERADMIN')
          OR app_user.agency_id = emilia_turn_jobs.agency_id
        )
    )
  );

CREATE OR REPLACE FUNCTION public.create_emilia_turn_job(
  p_api_key_id UUID,
  p_tenant_id UUID,
  p_agency_id UUID,
  p_request_id TEXT,
  p_conversation_key TEXT,
  p_payload JSONB,
  p_payload_hash TEXT
)
RETURNS SETOF public.emilia_turn_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.emilia_turn_jobs%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.api_keys AS api_key
    WHERE api_key.id = p_api_key_id
      AND api_key.tenant_id = p_tenant_id
      AND api_key.agency_id = p_agency_id
      AND api_key.is_active = true
      AND (api_key.expires_at IS NULL OR api_key.expires_at > NOW())
      AND EXISTS (
        SELECT 1
        FROM public.agencies AS agency
        WHERE agency.id = p_agency_id
          AND agency.tenant_id = p_tenant_id
      )
  ) THEN
    RAISE EXCEPTION 'invalid_api_key_context' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.emilia_turn_jobs AS expired_job
  WHERE expired_job.api_key_id = p_api_key_id
    AND expired_job.agency_id = p_agency_id
    AND expired_job.expires_at <= NOW();

  INSERT INTO public.emilia_turn_jobs (
    api_key_id,
    tenant_id,
    agency_id,
    request_id,
    conversation_key,
    payload,
    payload_hash
  ) VALUES (
    p_api_key_id,
    p_tenant_id,
    p_agency_id,
    p_request_id,
    p_conversation_key,
    p_payload,
    p_payload_hash
  )
  ON CONFLICT (api_key_id, request_id) DO NOTHING;

  SELECT job.*
  INTO v_job
  FROM public.emilia_turn_jobs AS job
  WHERE job.api_key_id = p_api_key_id
    AND job.request_id = p_request_id;

  IF v_job.payload_hash <> p_payload_hash THEN
    RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23505';
  END IF;

  RETURN NEXT v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_emilia_turn_job(
  p_job_id UUID,
  p_api_key_id UUID,
  p_tenant_id UUID,
  p_agency_id UUID
)
RETURNS SETOF public.emilia_turn_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.api_keys AS api_key
    WHERE api_key.id = p_api_key_id
      AND api_key.tenant_id = p_tenant_id
      AND api_key.agency_id = p_agency_id
      AND api_key.is_active = true
      AND (api_key.expires_at IS NULL OR api_key.expires_at > NOW())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT job.*
  FROM public.emilia_turn_jobs AS job
  WHERE job.id = p_job_id
    AND job.api_key_id = p_api_key_id
    AND job.tenant_id = p_tenant_id
    AND job.agency_id = p_agency_id
    AND job.expires_at > NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_emilia_turn_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 90
)
RETURNS SETOF public.emilia_turn_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.emilia_turn_jobs AS exhausted_job
  SET
    status = 'failed',
    stage = 'failed',
    worker_id = NULL,
    lease_expires_at = NULL,
    completed_at = NOW(),
    error = jsonb_build_object(
      'code', 'JOB_ATTEMPTS_EXHAUSTED',
      'message', 'Emilia turn exhausted its retry attempts',
      'status', 504
    )
  WHERE exhausted_job.status IN ('queued', 'processing')
    AND exhausted_job.attempt >= exhausted_job.max_attempts
    AND EXISTS (
      SELECT 1
      FROM public.emilia_turn_jobs AS requested_job
      WHERE requested_job.id = p_job_id
        AND requested_job.api_key_id = exhausted_job.api_key_id
        AND requested_job.agency_id = exhausted_job.agency_id
        AND requested_job.conversation_key = exhausted_job.conversation_key
    )
    AND (
      exhausted_job.status = 'queued'
      OR exhausted_job.lease_expires_at < NOW()
    );

  RETURN QUERY
  WITH requested AS (
    SELECT
      requested_job.api_key_id,
      requested_job.agency_id,
      requested_job.conversation_key
    FROM public.emilia_turn_jobs AS requested_job
    WHERE requested_job.id = p_job_id
      AND requested_job.status IN ('queued', 'processing')
      AND requested_job.expires_at > NOW()
  ), candidate AS (
    SELECT job.id
    FROM public.emilia_turn_jobs AS job
    JOIN requested
      ON requested.api_key_id = job.api_key_id
      AND requested.agency_id = job.agency_id
      AND requested.conversation_key = job.conversation_key
    WHERE job.status IN ('queued', 'processing')
      AND job.attempt < job.max_attempts
      AND job.expires_at > NOW()
    ORDER BY job.created_at, job.id
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.emilia_turn_jobs AS job
  SET
    status = 'processing',
    stage = 'starting',
    attempt = job.attempt + 1,
    worker_id = p_worker_id,
    lease_expires_at = NOW() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 300)),
    heartbeat_at = NOW(),
    started_at = COALESCE(job.started_at, NOW()),
    error = NULL
  FROM candidate
  WHERE job.id = candidate.id
    AND (
      job.status = 'queued'
      OR (job.status = 'processing' AND job.lease_expires_at < NOW())
    )
  RETURNING job.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_emilia_turn_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_stage TEXT,
  p_lease_seconds INTEGER DEFAULT 90
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.emilia_turn_jobs AS job
  SET
    stage = LEFT(COALESCE(NULLIF(p_stage, ''), job.stage), 80),
    heartbeat_at = NOW(),
    lease_expires_at = NOW() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 300))
  WHERE job.id = p_job_id
    AND job.status = 'processing'
    AND job.worker_id = p_worker_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_emilia_turn_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_result JSONB DEFAULT NULL,
  p_error JSONB DEFAULT NULL,
  p_retryable BOOLEAN DEFAULT false
)
RETURNS SETOF public.emilia_turn_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.emilia_turn_jobs AS job
  SET
    status = CASE
      WHEN p_result IS NOT NULL THEN 'completed'
      WHEN p_retryable AND job.attempt < job.max_attempts THEN 'queued'
      ELSE 'failed'
    END,
    stage = CASE
      WHEN p_result IS NOT NULL THEN 'completed'
      WHEN p_retryable AND job.attempt < job.max_attempts THEN 'retry_queued'
      ELSE 'failed'
    END,
    result = p_result,
    error = p_error,
    worker_id = NULL,
    lease_expires_at = NULL,
    heartbeat_at = NOW(),
    completed_at = CASE
      WHEN p_result IS NOT NULL OR NOT (p_retryable AND job.attempt < job.max_attempts)
        THEN NOW()
      ELSE NULL
    END
  WHERE job.id = p_job_id
    AND job.status = 'processing'
    AND job.worker_id = p_worker_id
  RETURNING job.*;
END;
$$;

REVOKE ALL ON public.emilia_turn_jobs FROM anon, authenticated;
GRANT SELECT ON public.emilia_turn_jobs TO authenticated;

REVOKE ALL ON FUNCTION public.create_emilia_turn_job(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_emilia_turn_job(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_emilia_turn_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_emilia_turn_job(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_emilia_turn_job(UUID, TEXT, JSONB, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_emilia_turn_job(UUID, UUID, UUID, TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_emilia_turn_job(UUID, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_emilia_turn_job(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_emilia_turn_job(UUID, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_emilia_turn_job(UUID, TEXT, JSONB, JSONB, BOOLEAN) TO service_role;

ALTER TABLE public.api_usage_events
  ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.increment_api_key_usage_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.billable THEN
    UPDATE public.api_keys
    SET usage_count = COALESCE(usage_count, 0) + 1
    WHERE id = NEW.api_key_id;
  END IF;

  UPDATE public.api_keys
  SET last_used_at = GREATEST(COALESCE(last_used_at, '-infinity'::timestamptz), NEW.created_at)
  WHERE id = NEW.api_key_id;

  RETURN NEW;
END;
$$;
