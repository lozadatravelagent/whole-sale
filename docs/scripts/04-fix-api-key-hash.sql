-- =====================================================
-- FIX: Actualizar Hash de API Key
-- =====================================================
--
-- Este script actualiza el hash de la API key existente
-- para que coincida con la API key completa
--
-- API KEY: wsk_dev_test123456789012345678901234
-- =====================================================

-- Eliminar API keys antiguas con hash incorrecto
DELETE FROM api_keys 
WHERE key_prefix = 'wsk_dev_';

-- Insertar la API key con el hash correcto
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
  usage_count,
  metadata
) VALUES (
  uuid_generate_v4(),
  'wsk_dev_',
  -- Hash SHA-256 de 'wsk_dev_test123456789012345678901234'
  encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex'),
  NULL,
  NULL,
  NULL,
  ARRAY['search:*'],
  1000,
  10000,
  100000,
  'Testing API Key - Fixed Hash',
  'development',
  true,
  NULL,
  NOW(),
  0,
  jsonb_build_object(
    'description', 'API key con hash corregido',
    'full_key', 'wsk_dev_test123456789012345678901234',
    'warning', 'DO NOT USE IN PRODUCTION'
  )
);

-- Verificar que se creó correctamente
SELECT 
  '✅ API Key actualizada con hash correcto' as status,
  key_prefix,
  name,
  key_hash,
  length(key_hash) as hash_length,
  is_active,
  scopes,
  created_at
FROM api_keys 
WHERE key_prefix = 'wsk_dev_'
ORDER BY created_at DESC 
LIMIT 1;

-- Mostrar el hash para debugging
SELECT 
  'Hash almacenado:' as tipo,
  key_hash as valor
FROM api_keys 
WHERE key_prefix = 'wsk_dev_'
ORDER BY created_at DESC 
LIMIT 1;
















