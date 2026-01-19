-- =====================================================
-- Generar API Key de Producción para Tercero
-- =====================================================
-- 
-- ⚠️ IMPORTANTE: Guarda la API key completa que se muestra al final
--    Solo se mostrará UNA VEZ. Si la pierdes, tendrás que revocar y crear una nueva.
--
-- Instrucciones:
-- 1. Abrí Supabase Dashboard
-- 2. Andá a SQL Editor
-- 3. Copiá y pegá este SQL completo
-- 4. Presioná "Run"
-- 5. Copiá la API key completa del resultado
-- =====================================================

DO $$
DECLARE
  -- Generar 32 caracteres aleatorios (base62: a-z, A-Z, 0-9)
  random_chars TEXT;
  api_key_full TEXT;
  key_prefix TEXT;
  key_hash TEXT;
  new_key_id UUID;
BEGIN
  -- Generar 32 caracteres aleatorios usando base62
  random_chars := array_to_string(
    ARRAY(
      SELECT substr(
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        floor(random() * 62)::int + 1,
        1
      )
      FROM generate_series(1, 32)
    ),
    ''
  );

  -- Construir API key completa: wsk_prod_<32chars>
  api_key_full := 'wsk_prod_' || random_chars;
  key_prefix := 'wsk_prod_';

  -- Calcular hash SHA-256
  key_hash := encode(digest(api_key_full::bytea, 'sha256'), 'hex');

  -- Insertar en la tabla
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
    key_prefix,
    key_hash,
    NULL,  -- tenant_id NULL para acceso global (ajustar si es necesario)
    NULL,  -- agency_id NULL
    NULL,  -- created_by NULL (o usar auth.uid() si estás autenticado)
    ARRAY['search:*'],  -- Permisos completos de búsqueda
    500,   -- 500 requests/minuto (ajustar según necesidades)
    10000,  -- 10000 requests/hora
    100000, -- 100000 requests/día
    'API Key para Tercero - Producción',
    'production',
    true,   -- Activa
    NULL,   -- Sin expiración (o usar: NOW() + INTERVAL '1 year' para expiración)
    NOW(),
    0,
    jsonb_build_object(
      'description', 'API key de producción para integración con tercero',
      'created_at', NOW(),
      'contact', 'Ajustar según necesidad'
    )
  )
  RETURNING id INTO new_key_id;

  -- Mostrar la API key completa (SOLO SE MUESTRA UNA VEZ)
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ API KEY GENERADA EXITOSAMENTE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'API KEY COMPLETA: %', api_key_full;
  RAISE NOTICE '========================================';
  RAISE NOTICE '⚠️  GUARDA ESTA KEY AHORA - NO SE VOLVERÁ A MOSTRAR';
  RAISE NOTICE '========================================';

END $$;

-- Mostrar la API key en el resultado (última creada)
SELECT 
  '✅ API KEY GENERADA' as status,
  CONCAT('wsk_prod_', SUBSTRING(key_hash, 1, 8)) as key_preview,
  '⚠️ La API key completa se muestra arriba en los NOTICE' as warning,
  name,
  environment,
  is_active,
  scopes,
  rate_limit_per_minute || '/min, ' || rate_limit_per_hour || '/hora, ' || rate_limit_per_day || '/día' as rate_limits,
  created_at
FROM api_keys 
WHERE environment = 'production'
ORDER BY created_at DESC 
LIMIT 1;

-- Verificar que se creó correctamente
SELECT 
  'Verificación' as check_type,
  key_prefix,
  name,
  environment,
  is_active,
  scopes,
  rate_limit_per_minute,
  rate_limit_per_hour,
  rate_limit_per_day,
  created_at
FROM api_keys 
WHERE environment = 'production'
ORDER BY created_at DESC 
LIMIT 1;

