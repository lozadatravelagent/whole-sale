-- =====================================================
-- Migration: Fix API key hash function search_path
-- Description: pgcrypto lives in the extensions schema on Supabase.
-- =====================================================

CREATE OR REPLACE FUNCTION public.hash_api_key(api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(extensions.digest(api_key, 'sha256'), 'hex');
END;
$$;
