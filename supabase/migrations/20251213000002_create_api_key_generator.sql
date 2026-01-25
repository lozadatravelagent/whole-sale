-- =====================================================
-- Migration: Create API Key Generator Function
-- Description: Función para generar API keys seguras con hash SHA-256
-- Date: 2025-12-13
-- =====================================================

-- Function to generate a random string for API keys
CREATE OR REPLACE FUNCTION generate_random_string(length INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to hash API key using SHA-256
CREATE OR REPLACE FUNCTION hash_api_key(api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(digest(api_key, 'sha256'), 'hex');
END;
$$;

-- Function to generate a complete API key with prefix
CREATE OR REPLACE FUNCTION generate_api_key(
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
AS $$
DECLARE
  v_id UUID;
  v_prefix TEXT;
  v_random_part TEXT;
  v_full_key TEXT;
  v_key_hash TEXT;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Generate ID
  v_id := uuid_generate_v4();
  v_created_at := NOW();

  -- Generate prefix based on environment
  -- Format: wsk_<env>_<8chars>
  -- wsk = WholeSale Key
  CASE p_environment
    WHEN 'production' THEN v_prefix := 'wsk_prod_';
    WHEN 'development' THEN v_prefix := 'wsk_dev_';
    WHEN 'staging' THEN v_prefix := 'wsk_stg_';
    ELSE v_prefix := 'wsk_prod_';
  END CASE;

  -- Generate random part (40 characters for security)
  v_random_part := generate_random_string(40);

  -- Combine to create full API key
  v_full_key := v_prefix || v_random_part;

  -- Hash the full key for storage
  v_key_hash := hash_api_key(v_full_key);

  -- Extract first 8 chars after prefix for identification
  v_prefix := v_prefix || substr(v_random_part, 1, 8);

  -- Insert into database (storing ONLY the hash, NOT the key)
  INSERT INTO api_keys (
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
    created_at
  ) VALUES (
    v_id,
    v_prefix,
    v_key_hash,
    p_tenant_id,
    p_agency_id,
    p_created_by,
    p_scopes,
    p_rate_limit_per_minute,
    p_rate_limit_per_hour,
    p_rate_limit_per_day,
    p_name,
    p_environment,
    true,
    p_expires_at,
    v_created_at
  );

  -- Return the key ONLY ONCE (never stored in DB)
  RETURN QUERY SELECT
    v_id AS id,
    v_full_key AS api_key,
    v_prefix AS key_prefix,
    p_environment AS environment,
    p_scopes AS scopes,
    v_created_at AS created_at;

  RAISE NOTICE '🔑 API Key generada exitosamente';
  RAISE NOTICE '⚠️  IMPORTANTE: Guarda esta key de forma segura, NO se mostrará nuevamente';
  RAISE NOTICE 'Key: %', v_full_key;
  RAISE NOTICE 'Prefix: %', v_prefix;
END;
$$;

COMMENT ON FUNCTION generate_api_key IS 'Genera una API key segura y devuelve el token UNA SOLA VEZ. La base de datos solo guarda el hash SHA-256.';

-- Function to revoke/deactivate an API key
CREATE OR REPLACE FUNCTION revoke_api_key(p_key_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE api_keys
  SET is_active = false
  WHERE id = p_key_id;

  IF FOUND THEN
    RAISE NOTICE '✅ API Key revocada exitosamente: %', p_key_id;
    RETURN true;
  ELSE
    RAISE NOTICE '❌ API Key no encontrada: %', p_key_id;
    RETURN false;
  END IF;
END;
$$;

COMMENT ON FUNCTION revoke_api_key IS 'Revoca (desactiva) una API key por su ID';

-- Function to rotate an API key (revoke old, generate new)
CREATE OR REPLACE FUNCTION rotate_api_key(p_old_key_id UUID)
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
AS $$
DECLARE
  v_old_key RECORD;
BEGIN
  -- Get old key info
  SELECT * INTO v_old_key
  FROM api_keys
  WHERE id = p_old_key_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'API Key no encontrada: %', p_old_key_id;
  END IF;

  -- Revoke old key
  UPDATE api_keys
  SET is_active = false
  WHERE id = p_old_key_id;

  RAISE NOTICE '🔄 Rotando API Key: % → Nueva key', v_old_key.key_prefix;

  -- Generate new key with same permissions
  RETURN QUERY SELECT * FROM generate_api_key(
    v_old_key.tenant_id,
    v_old_key.agency_id,
    v_old_key.created_by,
    v_old_key.name || ' (rotated)',
    v_old_key.environment,
    v_old_key.scopes,
    v_old_key.rate_limit_per_minute,
    v_old_key.rate_limit_per_hour,
    v_old_key.rate_limit_per_day,
    v_old_key.expires_at
  );
END;
$$;

COMMENT ON FUNCTION rotate_api_key IS 'Rota una API key (revoca la anterior y genera una nueva con los mismos permisos)';

-- Function to list API keys for a tenant (without showing the actual keys)
CREATE OR REPLACE FUNCTION list_api_keys(p_tenant_id UUID)
RETURNS TABLE(
  id UUID,
  key_prefix TEXT,
  name TEXT,
  environment TEXT,
  scopes TEXT[],
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count BIGINT,
  expires_at TIMESTAMPTZ,
  rate_limit_per_minute INTEGER,
  rate_limit_per_hour INTEGER,
  rate_limit_per_day INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.key_prefix,
    k.name,
    k.environment,
    k.scopes,
    k.is_active,
    k.created_at,
    k.last_used_at,
    k.usage_count,
    k.expires_at,
    k.rate_limit_per_minute,
    k.rate_limit_per_hour,
    k.rate_limit_per_day
  FROM api_keys k
  WHERE k.tenant_id = p_tenant_id
  ORDER BY k.created_at DESC;
END;
$$;

COMMENT ON FUNCTION list_api_keys IS 'Lista todas las API keys de un tenant (sin mostrar el token completo)';
