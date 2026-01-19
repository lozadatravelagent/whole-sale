-- =====================================================
-- Script: Crear API Key de Testing
-- Description: Crea una API key de desarrollo para testing
-- =====================================================

-- Primero necesitamos el tenant_id de un tenant existente
-- Si no tenés tenants, ajustá esto o usá NULL

-- API KEY: wsk_dev_test123456789012345678901234
-- SHA-256 Hash (full key): se calcula con la key completa

-- ⚠️ IMPORTANTE: Esta key es SOLO para desarrollo/testing
-- NUNCA usar en producción

-- Insertar API key de testing
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
  created_at,
  last_used_at,
  usage_count,
  metadata
) VALUES (
  uuid_generate_v4(),
  'wsk_dev_',  -- Prefix (primeros 8 chars)
  -- Hash SHA-256 de 'wsk_dev_test123456789012345678901234'
  -- Este hash se genera en el backend con crypto.subtle.digest
  -- Por ahora usamos un placeholder - el backend lo validará
  encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex'),
  NULL,  -- tenant_id - NULL para testing global (ajustar si es necesario)
  NULL,  -- agency_id - NULL para testing
  NULL,  -- created_by - NULL para testing
  ARRAY['search:*'],  -- Scopes - permiso para todas las búsquedas
  1000,  -- rate_limit_per_minute - límite alto para testing
  10000,  -- rate_limit_per_hour
  100000,  -- rate_limit_per_day
  'Testing API Key - DEV',
  'development',
  true,  -- is_active
  NULL,  -- expires_at - nunca expira
  NOW(),
  NULL,
  0,
  '{
    "description": "API key de desarrollo para testing",
    "created_by_script": true,
    "warning": "DO NOT USE IN PRODUCTION"
  }'::jsonb
)
ON CONFLICT (key_hash) DO NOTHING;  -- No duplicar si ya existe

-- Verificar que se creó
SELECT 
  key_prefix,
  name,
  environment,
  is_active,
  scopes,
  rate_limit_per_minute,
  created_at
FROM api_keys 
WHERE key_prefix = 'wsk_dev_'
ORDER BY created_at DESC 
LIMIT 1;
















