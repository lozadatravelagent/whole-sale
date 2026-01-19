-- =====================================================
-- VERIFICAR API Key
-- =====================================================
-- 
-- Ejecutá este SQL para verificar que la API key existe
-- 
-- =====================================================

SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ API Key EXISTS'
    ELSE '❌ API Key NOT FOUND - Ejecutá 01-create-api-key.sql primero'
  END as status,
  COUNT(*) as total_keys
FROM api_keys 
WHERE key_prefix = 'wsk_dev_'
  AND is_active = true;

-- Detalles de la API key
SELECT 
  key_prefix,
  name,
  environment,
  is_active,
  scopes,
  rate_limit_per_minute,
  rate_limit_per_hour,
  rate_limit_per_day,
  usage_count,
  last_used_at,
  created_at
FROM api_keys 
WHERE key_prefix = 'wsk_dev_'
ORDER BY created_at DESC;
















