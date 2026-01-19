-- =====================================================
-- GENERAR API KEY DE PRODUCCIÓN PARA www.maxevagestion.com
-- =====================================================
-- 
-- ⚠️ IMPORTANTE: Esta API key se mostrará UNA SOLA VEZ
-- Guardala en un lugar seguro (variables de entorno, secrets manager, etc.)
-- 
-- Ejecutá este script en Supabase SQL Editor:
-- https://app.supabase.com/project/ujigyazketblwlzcomve/sql
-- =====================================================

-- PASO 1: Obtener tu tenant_id (reemplazá con tu email)
DO $$
DECLARE
  v_tenant_id UUID;
  v_user_email TEXT := 'tu-email@ejemplo.com'; -- 🔴 CAMBIAR ESTO POR TU EMAIL
  v_result RECORD;
BEGIN
  -- Obtener tenant_id del usuario
  SELECT tenant_id INTO v_tenant_id
  FROM users
  WHERE email = v_user_email;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado o sin tenant asignado: %', v_user_email;
  END IF;

  RAISE NOTICE '✅ Tenant ID encontrado: %', v_tenant_id;
  RAISE NOTICE '📧 Usuario: %', v_user_email;
  RAISE NOTICE '';

  -- PASO 2: Generar API key de producción
  RAISE NOTICE '🔑 Generando API key de PRODUCCIÓN...';
  RAISE NOTICE '';

  SELECT * INTO v_result FROM generate_api_key(
    p_tenant_id := v_tenant_id,
    p_agency_id := NULL,                           -- NULL = válida para todas las agencies del tenant
    p_created_by := NULL,
    p_name := 'Producción - www.maxevagestion.com',
    p_environment := 'production',
    p_scopes := ARRAY['search:*'],                 -- Permisos completos de búsqueda
    p_rate_limit_per_minute := 100,                -- 100 requests/minuto
    p_rate_limit_per_hour := 1000,                 -- 1000 requests/hora  
    p_rate_limit_per_day := 10000,                 -- 10000 requests/día
    p_expires_at := NULL                           -- Sin expiración
  );

  -- Mostrar resultado
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 API KEY GENERADA EXITOSAMENTE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 API KEY (guardala AHORA, no se mostrará nuevamente):';
  RAISE NOTICE '%', v_result.api_key;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Detalles:';
  RAISE NOTICE '  • ID: %', v_result.id;
  RAISE NOTICE '  • Prefix: %', v_result.key_prefix;
  RAISE NOTICE '  • Entorno: %', v_result.environment;
  RAISE NOTICE '  • Scopes: %', v_result.scopes;
  RAISE NOTICE '  • Creada: %', v_result.created_at;
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Configurar allowed_origins...';

  -- PASO 3: Configurar allowed_origins en metadata
  UPDATE api_keys
  SET metadata = jsonb_build_object(
    'allowed_origins', ARRAY[
      'https://www.maxevagestion.com',
      'https://maxevagestion.com'
    ],
    'description', 'API key de producción para sistema de chat',
    'created_for', 'www.maxevagestion.com'
  )
  WHERE id = v_result.id;

  RAISE NOTICE '✅ Origins configurados: https://www.maxevagestion.com';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '📌 PRÓXIMOS PASOS:';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '1. Guardá la API key en tus variables de entorno:';
  RAISE NOTICE '   EMILIA_API_KEY=%', v_result.api_key;
  RAISE NOTICE '';
  RAISE NOTICE '2. Configurá la URL del endpoint:';
  RAISE NOTICE '   EMILIA_API_URL=https://api.vibook.ai/search';
  RAISE NOTICE '   (o directo a Supabase: https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search)';
  RAISE NOTICE '';
  RAISE NOTICE '3. Probá la conexión con:';
  RAISE NOTICE '   curl -X POST https://api.vibook.ai/search \';
  RAISE NOTICE '     -H "Content-Type: application/json" \';
  RAISE NOTICE '     -H "X-API-Key: %" \', v_result.api_key;
  RAISE NOTICE '     -d ''{"request_id":"test_001","prompt":"vuelo a miami"}''';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';

END $$;
