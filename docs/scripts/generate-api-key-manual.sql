-- =====================================================
-- GENERAR API KEY - VERSIÓN MANUAL (Sin usuarios del sistema)
-- =====================================================
--
-- ⚠️ IMPORTANTE: Esta API key se mostrará UNA SOLA VEZ
--
-- Esta versión te permite especificar directamente el tenant_id
-- o usar uno existente si ya tenés un tenant creado.
--
-- Ejecutá este script en Supabase SQL Editor:
-- https://app.supabase.com/project/ujigyazketblwlzcomve/sql
-- =====================================================

-- OPCIÓN 1: Listar tenants existentes
-- Ejecutá esto primero para ver qué tenants tenés disponibles
SELECT
  id,
  name,
  created_at
FROM tenants
ORDER BY created_at DESC;

-- =====================================================
-- OPCIÓN 2: Crear un tenant nuevo para el cliente externo
-- =====================================================
-- Descomentá esto si querés crear un tenant nuevo
/*
INSERT INTO tenants (id, name, created_at)
VALUES (
  uuid_generate_v4(),
  'MaxevaGestion',  -- 🔴 CAMBIAR: Nombre del cliente
  NOW()
)
RETURNING id, name;
*/

-- =====================================================
-- OPCIÓN 3: Generar API key usando un tenant_id específico
-- =====================================================

-- 🔴 PASO 1: Reemplazá este UUID con el tenant_id que elegiste
-- (puede ser uno de OPCIÓN 1, o el creado en OPCIÓN 2)

DO $$
DECLARE
  v_tenant_id UUID := 'REEMPLAZAR-CON-TENANT-ID-AQUI'; -- 🔴 CAMBIAR ESTO
  v_result RECORD;
BEGIN
  -- Validar que el tenant existe
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Tenant no encontrado: %. Ejecutá OPCIÓN 1 para ver tenants disponibles.', v_tenant_id;
  END IF;

  RAISE NOTICE '✅ Usando tenant: %', v_tenant_id;
  RAISE NOTICE '';

  -- Generar API key
  RAISE NOTICE '🔑 Generando API key de PRODUCCIÓN...';
  RAISE NOTICE '';

  SELECT * INTO v_result FROM generate_api_key(
    p_tenant_id := v_tenant_id,
    p_agency_id := NULL,
    p_created_by := NULL,
    p_name := 'Producción - www.maxevagestion.com',
    p_environment := 'production',
    p_scopes := ARRAY['search:*'],
    p_rate_limit_per_minute := 100,
    p_rate_limit_per_hour := 1000,
    p_rate_limit_per_day := 10000,
    p_expires_at := NULL
  );

  -- Mostrar resultado
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 API KEY GENERADA EXITOSAMENTE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 API KEY (guardala AHORA):';
  RAISE NOTICE '%', v_result.api_key;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Detalles:';
  RAISE NOTICE '  • ID: %', v_result.id;
  RAISE NOTICE '  • Tenant ID: %', v_tenant_id;
  RAISE NOTICE '  • Prefix: %', v_result.key_prefix;
  RAISE NOTICE '  • Entorno: %', v_result.environment;
  RAISE NOTICE '';

  -- Configurar allowed_origins
  UPDATE api_keys
  SET metadata = jsonb_build_object(
    'allowed_origins', ARRAY[
      'https://www.maxevagestion.com',
      'https://maxevagestion.com'
    ],
    'description', 'API key para cliente externo',
    'created_for', 'www.maxevagestion.com'
  )
  WHERE id = v_result.id;

  RAISE NOTICE '✅ Configuración completada';
  RAISE NOTICE '';
  RAISE NOTICE 'Guardá esta API key: %', v_result.api_key;
  RAISE NOTICE '';

END $$;
