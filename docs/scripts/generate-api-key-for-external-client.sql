-- =====================================================
-- GENERAR API KEY PARA CLIENTE EXTERNO (www.maxevagestion.com)
-- =====================================================
--
-- ⚠️ IMPORTANTE: Esta API key se mostrará UNA SOLA VEZ
-- Guardala en un lugar seguro (variables de entorno, secrets manager, etc.)
--
-- Este script crea una API key para un consumidor EXTERNO que NO está en tu sistema
--
-- Ejecutá este script en Supabase SQL Editor:
-- https://app.supabase.com/project/ujigyazketblwlzcomve/sql
-- =====================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT := 'MaxevaGestion'; -- Nombre del cliente externo
  v_result RECORD;
  v_api_key_id UUID;
BEGIN
  -- PASO 1: Buscar si ya existe un tenant para este cliente externo
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE name = v_tenant_name;

  -- Si no existe, crear uno nuevo para el cliente externo
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE '📋 Creando tenant para cliente externo: %', v_tenant_name;

    INSERT INTO tenants (name, created_at)
    VALUES (v_tenant_name, NOW())
    RETURNING id INTO v_tenant_id;

    RAISE NOTICE '✅ Tenant creado: %', v_tenant_id;
  ELSE
    RAISE NOTICE '✅ Tenant existente encontrado: %', v_tenant_id;
  END IF;

  RAISE NOTICE '📧 Cliente: %', v_tenant_name;
  RAISE NOTICE '🌐 Dominio: www.maxevagestion.com';
  RAISE NOTICE '';

  -- PASO 2: Generar API key de producción
  RAISE NOTICE '🔑 Generando API key de PRODUCCIÓN...';
  RAISE NOTICE '';

  SELECT * INTO v_result FROM generate_api_key(
    p_tenant_id := v_tenant_id,
    p_agency_id := NULL,
    p_created_by := NULL,
    p_name := 'Producción - www.maxevagestion.com (Cliente Externo)',
    p_environment := 'production',
    p_scopes := ARRAY['search:*'],
    p_rate_limit_per_minute := 100,
    p_rate_limit_per_hour := 1000,
    p_rate_limit_per_day := 10000,
    p_expires_at := NULL
  );

  v_api_key_id := v_result.id;

  -- PASO 3: Configurar allowed_origins en metadata
  UPDATE api_keys
  SET metadata = jsonb_build_object(
    'allowed_origins', ARRAY[
      'https://www.maxevagestion.com',
      'https://maxevagestion.com'
    ],
    'description', 'API key de producción para cliente externo',
    'created_for', 'www.maxevagestion.com',
    'client_name', v_tenant_name,
    'client_email', 'maxi@erplozada.com',
    'is_external_client', true
  )
  WHERE id = v_api_key_id;

  -- PASO 4: Mostrar resultado en NOTICES (revisar pestaña "Messages" del SQL Editor)
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 API KEY GENERADA EXITOSAMENTE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 API KEY (guardala AHORA, no se mostrará nuevamente):';
  RAISE NOTICE '%', v_result.api_key;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Detalles:';
  RAISE NOTICE '  • ID: %', v_result.id;
  RAISE NOTICE '  • Tenant: % (%)', v_tenant_name, v_tenant_id;
  RAISE NOTICE '  • Prefix: %', v_result.key_prefix;
  RAISE NOTICE '  • Entorno: %', v_result.environment;
  RAISE NOTICE '  • Scopes: %', v_result.scopes;
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'GUARDÁ ESTA API KEY: %', v_result.api_key;
  RAISE NOTICE '════════════════════════════════════════════════════════════════';

END $$;

-- =====================================================
-- MOSTRAR LA API KEY RECIÉN CREADA (Resultados visibles)
-- =====================================================
-- Este SELECT mostrará la API key en los resultados del SQL Editor

SELECT
  '🎉 API KEY GENERADA EXITOSAMENTE' as status,
  '⚠️ GUARDÁ ESTA API KEY AHORA (no se mostrará nuevamente)' as warning,
  ak.id as api_key_id,
  t.name as tenant_name,
  '🔑 LA API KEY ESTÁ EN LA PESTAÑA "MESSAGES" ARRIBA' as note,
  '(Buscá "GUARDÁ ESTA API KEY:" en los mensajes)' as instruction,
  ak.key_prefix,
  ak.name as api_key_name,
  ak.environment,
  ak.scopes,
  ak.rate_limit_per_minute,
  ak.rate_limit_per_hour,
  ak.rate_limit_per_day,
  ak.metadata->'allowed_origins' as allowed_origins,
  ak.created_at
FROM api_keys ak
JOIN tenants t ON ak.tenant_id = t.id
WHERE t.name = 'MaxevaGestion'
ORDER BY ak.created_at DESC
LIMIT 1;
