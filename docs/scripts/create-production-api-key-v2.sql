-- =====================================================
-- Generar API Key de Producción para Tercero (Versión 2)
-- =====================================================
-- 
-- ⚠️ IMPORTANTE: La API key completa aparecerá en el resultado de la query
--    Guárdala inmediatamente - solo se mostrará una vez.
--
-- Instrucciones:
-- 1. Abrí Supabase Dashboard → SQL Editor
-- 2. Copiá y pegá este SQL completo
-- 3. Presioná "Run"
-- 4. Copiá la API key del resultado (columna "api_key_completa")
-- =====================================================

-- Función temporal para generar API key
CREATE OR REPLACE FUNCTION generate_api_key_for_third_party(
  p_name TEXT DEFAULT 'API Key para Tercero - Producción',
  p_rate_limit_per_minute INTEGER DEFAULT 500,
  p_rate_limit_per_hour INTEGER DEFAULT 10000,
  p_rate_limit_per_day INTEGER DEFAULT 100000,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  status TEXT,
  api_key_completa TEXT,
  key_id UUID,
  key_prefix TEXT,
  environment TEXT,
  scopes TEXT[],
  rate_limits TEXT,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
AS $$
DECLARE
  random_chars TEXT;
  api_key_full TEXT;
  key_prefix TEXT;
  key_hash TEXT;
  new_key_id UUID;
BEGIN
  -- Generar 32 caracteres aleatorios (base62)
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

  -- Construir API key completa
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
    NULL,
    NULL,
    NULL,
    ARRAY['search:*'],
    p_rate_limit_per_minute,
    p_rate_limit_per_hour,
    p_rate_limit_per_day,
    p_name,
    'production',
    true,
    p_expires_at,
    NOW(),
    0,
    jsonb_build_object(
      'description', 'API key de producción para integración con tercero',
      'created_at', NOW()
    )
  )
  RETURNING id INTO new_key_id;

  -- Retornar la API key completa
  RETURN QUERY SELECT 
    '✅ API Key creada exitosamente'::TEXT,
    api_key_full::TEXT,
    new_key_id,
    key_prefix::TEXT,
    'production'::TEXT,
    ARRAY['search:*']::TEXT[],
    (p_rate_limit_per_minute::TEXT || '/min, ' || 
     p_rate_limit_per_hour::TEXT || '/hora, ' || 
     p_rate_limit_per_day::TEXT || '/día')::TEXT,
    NOW();
END;
$$;

-- Ejecutar la función y mostrar resultado
SELECT * FROM generate_api_key_for_third_party();

-- Limpiar función temporal (opcional - puedes dejarla para uso futuro)
-- DROP FUNCTION IF EXISTS generate_api_key_for_third_party(TEXT, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ);

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
WHERE environment = 'production'
ORDER BY created_at DESC 
LIMIT 1;












