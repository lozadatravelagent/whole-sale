-- RPC for polling async search jobs from the browser.
--
-- Why this exists
-- ---------------
-- The original `search_jobs` SELECT policy requires a JOIN through
-- leads → agencies → users to authorize a read. That join fails for jobs
-- whose conversation has no lead yet (the common case: a brand-new chat
-- conversation that just dispatched its first hotel search).
--
-- Edge functions write to search_jobs with the service-role key (bypassing
-- RLS), so the persist side has always worked. The polling side, run from
-- the browser with the user's anon JWT, hits the policy and returns HTTP
-- 406 ("Cannot coerce the result to a single JSON object") because the row
-- isn't visible.
--
-- This RPC sidesteps the policy with SECURITY DEFINER while keeping a
-- minimal authorization check: only authenticated callers can invoke it.
-- The jobId itself is a v4 UUID generated client-side; an attacker would
-- need to guess a 122-bit secret to leak another user's job. Read-only
-- access; no mutation.
--
-- The function returns the minimal projection the client needs to drive
-- its polling loop (`status`, `results`, `error`, `completed_at`).

CREATE OR REPLACE FUNCTION public.get_search_job_status(p_job_id uuid)
RETURNS TABLE (
  status text,
  results jsonb,
  error text,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  RETURN QUERY
  SELECT
    sj.status,
    sj.results,
    sj.error,
    sj.completed_at
  FROM public.search_jobs sj
  WHERE sj.id = p_job_id;
END;
$$;

-- Allow any authenticated caller to invoke. Authorization on the row is
-- implicit (knowing the UUID is the secret) — see comment above.
REVOKE ALL ON FUNCTION public.get_search_job_status(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_search_job_status(uuid) TO authenticated;
