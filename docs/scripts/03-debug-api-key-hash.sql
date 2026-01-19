-- =====================================================
-- DEBUG: Verificar Hash de API Key
-- =====================================================

-- Ver las API keys actuales y sus hashes
SELECT 
  key_prefix,
  name,
  key_hash,
  length(key_hash) as hash_length,
  is_active,
  scopes
FROM api_keys 
WHERE key_prefix = 'wsk_dev_'
ORDER BY created_at DESC;

-- Calcular el hash correcto para nuestra API key
SELECT 
  'Hash esperado para wsk_dev_test123456789012345678901234:' as descripcion,
  encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex') as hash_calculado,
  length(encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex')) as hash_length;

-- Verificar si alguna key coincide con nuestro hash
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM api_keys 
      WHERE key_hash = encode(digest('wsk_dev_test123456789012345678901234', 'sha256'), 'hex')
      AND is_active = true
    ) THEN '✅ Hash CORRECTO - La API key debería funcionar'
    ELSE '❌ Hash NO COINCIDE - Necesitamos actualizar el hash'
  END as resultado;
















