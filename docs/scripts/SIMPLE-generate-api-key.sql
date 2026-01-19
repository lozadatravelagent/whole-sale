-- =====================================================
-- 🔑 GENERAR API KEY - VERSIÓN SIMPLE
-- =====================================================
--
-- Esta versión DEVUELVE LA API KEY en los resultados directamente
-- (más fácil de ver en Supabase SQL Editor)
--
-- ⚠️ IMPORTANTE: La API key se mostrará UNA SOLA VEZ
-- =====================================================

-- PASO 1: Crear tenant si no existe
INSERT INTO tenants (name, created_at)
SELECT 'MaxevaGestion', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM tenants WHERE name = 'MaxevaGestion'
);

-- PASO 2: Generar API key y configurar metadata
WITH api_key_generated AS (
  SELECT * FROM generate_api_key(
    p_tenant_id := (SELECT id FROM tenants WHERE name = 'MaxevaGestion'),
    p_agency_id := NULL,
    p_created_by := NULL,
    p_name := 'Producción - www.maxevagestion.com',
    p_environment := 'production',
    p_scopes := ARRAY['search:*'],
    p_rate_limit_per_minute := 100,
    p_rate_limit_per_hour := 1000,
    p_rate_limit_per_day := 10000,
    p_expires_at := NULL
  )
),
update_metadata AS (
  UPDATE api_keys
  SET metadata = jsonb_build_object(
    'allowed_origins', ARRAY[
      'https://www.maxevagestion.com',
      'https://maxevagestion.com'
    ],
    'description', 'API key de producción para cliente externo',
    'created_for', 'www.maxevagestion.com',
    'client_name', 'MaxevaGestion',
    'is_external_client', true
  )
  WHERE id = (SELECT id FROM api_key_generated)
  RETURNING id
)
-- MOSTRAR LA API KEY EN LOS RESULTADOS
SELECT
  '🎉 API KEY GENERADA EXITOSAMENTE' as "ESTADO",
  '' as "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  '⚠️ GUARDÁ ESTA API KEY AHORA (no se mostrará nuevamente)' as "ADVERTENCIA",
  '' as "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  api_key as "🔑 API KEY COMPLETA (copiá esto)",
  '' as "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  key_prefix as "Prefix",
  environment as "Entorno",
  scopes as "Permisos",
  created_at as "Creada",
  '' as "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  'Configurá estas variables de entorno en producción:' as "📋 INSTRUCCIONES",
  'EMILIA_API_KEY=' || api_key as "Variable 1 (Railway/Vercel)",
  'EMILIA_API_URL=https://api.vibook.ai/search' as "Variable 2 (Railway/Vercel)"
FROM api_key_generated;
