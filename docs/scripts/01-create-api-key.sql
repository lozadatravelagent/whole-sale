-- =====================================================
-- PASO 1: Crear API Key de Testing
-- =====================================================
-- 
-- ⚠️ EJECUTÁ ESTE SQL PRIMERO antes de correr los tests
--
-- API KEY completa: wsk_dev_test123456789012345678901234
-- 
-- Instrucciones:
-- 1. Abrí Supabase Dashboard
-- 2. Andá a SQL Editor
-- 3. Copiá y pegá este SQL completo
-- 4. Presioná "Run"
-- =====================================================

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
  usage_count,
  metadata
) VALUES (
  uuid_generate_v4(),
  'wsk_dev_',
  -- Hash SHA-256 de la API key completa
  encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex'),
  NULL,  -- tenant_id NULL para testing global
  NULL,  -- agency_id NULL  
  NULL,  -- created_by NULL
  ARRAY['search:*'],  -- Permisos completos
  1000,   -- 1000 requests/minuto
  10000,  -- 10000 requests/hora
  100000, -- 100000 requests/día
  'Testing API Key - DEV ONLY',
  'development',
  true,   -- Activa
  NULL,   -- Sin expiración
  NOW(),
  0,
  jsonb_build_object(
    'description', 'API key de desarrollo para testing',
    'created_by_script', true,
    'warning', 'DO NOT USE IN PRODUCTION'
  )
)
ON CONFLICT (key_hash) DO NOTHING;

-- Verificar que se creó correctamente
SELECT 
  '✅ API Key creada exitosamente' as status,
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

-- Si ves un resultado aquí arriba, la API key está lista ✅
















