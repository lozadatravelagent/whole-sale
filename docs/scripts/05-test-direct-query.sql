-- =====================================================
-- TEST: Verificación COMPLETA de API Key
-- =====================================================

-- 1. Ver TODAS las API keys
SELECT 
  'Todas las API keys:' as seccion;

SELECT 
  id,
  key_prefix,
  substring(key_hash, 1, 20) || '...' as hash_preview,
  name,
  is_active,
  scopes,
  environment,
  created_at
FROM api_keys 
ORDER BY created_at DESC;

-- 2. Calcular el hash que DEBERÍA tener nuestra API key
SELECT 
  'Hash calculado para nuestra API key:' as seccion;

SELECT 
  encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex') as hash_correcto,
  length(encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex')) as hash_length;

-- 3. Intentar encontrar la key por hash
SELECT 
  'Buscar por hash exacto:' as seccion;

SELECT 
  id,
  key_prefix,
  name,
  is_active,
  CASE 
    WHEN key_hash = encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex') 
    THEN '✅ HASH COINCIDE'
    ELSE '❌ HASH NO COINCIDE'
  END as hash_check
FROM api_keys 
WHERE key_prefix = 'wsk_dev_'
ORDER BY created_at DESC;

-- 4. Verificar si existe con el hash correcto
SELECT 
  'Resultado final:' as seccion;

SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ API Key EXISTE con hash correcto'
    ELSE '❌ API Key NO EXISTE o tiene hash incorrecto'
  END as resultado,
  COUNT(*) as total_keys_validas
FROM api_keys 
WHERE key_hash = encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex')
  AND is_active = true;
















