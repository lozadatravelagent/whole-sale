-- =====================================================
-- Migration: Support external identities for API keys
-- Description: Allows API keys to be generated for tenant/agency IDs that
--              originate in another Supabase project by creating local
--              shadow tenant/agency rows in Emilia.
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_api_key(
  p_tenant_id UUID,
  p_agency_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT 'production',
  p_scopes TEXT[] DEFAULT ARRAY['search:*'],
  p_rate_limit_per_minute INTEGER DEFAULT 100,
  p_rate_limit_per_hour INTEGER DEFAULT 1000,
  p_rate_limit_per_day INTEGER DEFAULT 10000,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  api_key TEXT,
  key_prefix TEXT,
  environment TEXT,
  scopes TEXT[],
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_prefix TEXT;
  v_random_part TEXT;
  v_full_key TEXT;
  v_key_hash TEXT;
  v_created_at TIMESTAMPTZ;
  v_created_by UUID;
  v_existing_agency_tenant_id UUID;
  v_tenant_shadow_created BOOLEAN := false;
  v_agency_shadow_created BOOLEAN := false;
  v_metadata JSONB;
BEGIN
  v_id := gen_random_uuid();
  v_created_at := NOW();

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  INSERT INTO public.tenants (id, name, status)
  VALUES (
    p_tenant_id,
    'External tenant ' || left(p_tenant_id::text, 8),
    'active'
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING true INTO v_tenant_shadow_created;

  v_tenant_shadow_created := COALESCE(v_tenant_shadow_created, false);

  IF p_agency_id IS NOT NULL THEN
    SELECT agency.tenant_id
    INTO v_existing_agency_tenant_id
    FROM public.agencies AS agency
    WHERE agency.id = p_agency_id;

    IF v_existing_agency_tenant_id IS NOT NULL AND v_existing_agency_tenant_id <> p_tenant_id THEN
      RAISE EXCEPTION 'Agency % belongs to tenant %, not requested tenant %',
        p_agency_id,
        v_existing_agency_tenant_id,
        p_tenant_id;
    END IF;

    IF v_existing_agency_tenant_id IS NULL THEN
      INSERT INTO public.agencies (id, tenant_id, name, status, branding)
      VALUES (
        p_agency_id,
        p_tenant_id,
        'External agency ' || left(p_agency_id::text, 8),
        'active',
        jsonb_build_object(
          'source', 'external_api_key',
          'external', true
        )
      );
      v_agency_shadow_created := true;
    END IF;
  END IF;

  IF p_created_by IS NOT NULL THEN
    SELECT app_user.id
    INTO v_created_by
    FROM public.users AS app_user
    WHERE app_user.id = p_created_by;
  END IF;

  CASE p_environment
    WHEN 'production' THEN v_prefix := 'wsk_prod_';
    WHEN 'development' THEN v_prefix := 'wsk_dev_';
    WHEN 'staging' THEN v_prefix := 'wsk_stg_';
    ELSE v_prefix := 'wsk_prod_';
  END CASE;

  v_random_part := public.generate_random_string(40);
  v_full_key := v_prefix || v_random_part;
  v_key_hash := public.hash_api_key(v_full_key);
  v_prefix := v_prefix || substr(v_random_part, 1, 8);

  v_metadata := jsonb_build_object(
    'identity_mode', 'external_shadow_supported',
    'requested_tenant_id', p_tenant_id,
    'requested_agency_id', p_agency_id,
    'requested_created_by', p_created_by,
    'created_by_is_local_user', v_created_by IS NOT NULL,
    'tenant_shadow_created', v_tenant_shadow_created,
    'agency_shadow_created', v_agency_shadow_created
  );

  INSERT INTO public.api_keys (
    id,
    key_prefix,
    key_hash,
    tenant_id,
    agency_id,
    created_by,
    scopes,
    rate_limit_per_minute,
    rate_limit_per_hour,
    rate_limit_per_day,
    name,
    environment,
    is_active,
    expires_at,
    created_at,
    metadata
  ) VALUES (
    v_id,
    v_prefix,
    v_key_hash,
    p_tenant_id,
    p_agency_id,
    v_created_by,
    p_scopes,
    p_rate_limit_per_minute,
    p_rate_limit_per_hour,
    p_rate_limit_per_day,
    p_name,
    p_environment,
    true,
    p_expires_at,
    v_created_at,
    v_metadata
  );

  RETURN QUERY SELECT
    v_id AS id,
    v_full_key AS api_key,
    v_prefix AS key_prefix,
    p_environment AS environment,
    p_scopes AS scopes,
    v_created_at AS created_at;

  RAISE NOTICE 'API key generated successfully';
  RAISE NOTICE 'Important: store this key securely; it will not be shown again';
  RAISE NOTICE 'Prefix: %', v_prefix;
END;
$$;

COMMENT ON FUNCTION public.generate_api_key IS 'Genera una API key segura. Si tenant/agency externos no existen en Emilia, crea shadow rows locales con los mismos UUIDs. La DB solo guarda el hash SHA-256.';
