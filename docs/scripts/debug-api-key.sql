-- =====================================================
-- DEBUG: Verificar estado de la API key de producción
-- =====================================================
--
-- Ejecutá este script en Supabase SQL Editor para verificar
-- que la API key esté correctamente configurada
--
-- https://app.supabase.com/project/ujigyazketblwlzcomve/sql
-- =====================================================

-- 1. Verificar que la API key existe y está activa
SELECT
  '1. Estado de la API key' as "PASO",
  key_prefix,
  name,
  environment,
  is_active,
  scopes,
  created_at,
  last_used_at,
  usage_count
FROM api_keys
WHERE key_prefix = 'wsk_prod_LHEoIcQ2'
ORDER BY created_at DESC
LIMIT 1;

-- 2. Verificar allowed_origins
SELECT
  '2. Dominios permitidos' as "PASO",
  metadata->'allowed_origins' as allowed_origins,
  metadata->'client_name' as client_name,
  metadata->'description' as description
FROM api_keys
WHERE key_prefix = 'wsk_prod_LHEoIcQ2';

-- 3. Verificar rate limits
SELECT
  '3. Rate Limits' as "PASO",
  rate_limit_per_minute,
  rate_limit_per_hour,
  rate_limit_per_day,
  usage_count
FROM api_keys
WHERE key_prefix = 'wsk_prod_LHEoIcQ2';

-- 4. Probar hash de la API key (verificar que coincide)
-- Si este query NO devuelve resultados, la API key es incorrecta
SELECT
  '4. Verificación de hash' as "PASO",
  CASE
    WHEN key_hash = encode(digest('wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg', 'sha256'), 'hex')
    THEN '✅ API key correcta'
    ELSE '❌ API key NO coincide con el hash almacenado'
  END as verification,
  key_prefix,
  created_at
FROM api_keys
WHERE key_prefix = 'wsk_prod_LHEoIcQ2';

-- 5. Listar TODAS las API keys de producción
SELECT
  '5. Todas las API keys de producción' as "PASO",
  key_prefix,
  name,
  environment,
  is_active,
  scopes,
  created_at
FROM api_keys
WHERE environment = 'production'
ORDER BY created_at DESC;
