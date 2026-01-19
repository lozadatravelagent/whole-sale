-- ============================================================================
-- SCRIPT DE INSPECCIÓN: Estado actual de RLS en tabla users
-- ============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Propósito: Verificar el estado completo de RLS, policies e índices

-- ============================================================================
-- 1. VERIFICAR SI RLS ESTÁ HABILITADO
-- ============================================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity THEN '✅ RLS HABILITADO'
    ELSE '❌ RLS DESHABILITADO - ⚠️ RIESGO DE SEGURIDAD'
  END AS status
FROM pg_tables
WHERE tablename = 'users' AND schemaname = 'public';

-- ============================================================================
-- 2. LISTAR TODAS LAS POLICIES EXISTENTES EN LA TABLA USERS
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS operation,
  qual AS using_expression,
  with_check AS with_check_expression,
  CASE
    WHEN policyname LIKE '%temp%' THEN '⚠️ POLICY TEMPORAL - DEBE ELIMINARSE'
    WHEN policyname LIKE '%owner can%' THEN '⚠️ POLICY ANTIGUA - POSIBLEMENTE DUPLICADA'
    WHEN policyname LIKE 'users_%_policy' THEN '✅ POLICY PRODUCTIVA'
    ELSE '⚠️ VERIFICAR'
  END AS policy_status
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY
  CASE
    WHEN policyname LIKE '%temp%' THEN 1
    WHEN policyname LIKE '%owner can%' THEN 2
    WHEN policyname LIKE 'users_%_policy' THEN 3
    ELSE 4
  END,
  policyname;

-- ============================================================================
-- 3. CONTAR POLICIES POR TIPO
-- ============================================================================
SELECT
  COUNT(*) AS total_policies,
  SUM(CASE WHEN policyname LIKE '%temp%' THEN 1 ELSE 0 END) AS temp_policies,
  SUM(CASE WHEN policyname LIKE 'users_%_policy' THEN 1 ELSE 0 END) AS production_policies,
  SUM(CASE WHEN policyname LIKE '%owner can%' THEN 1 ELSE 0 END) AS old_policies
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public';

-- ============================================================================
-- 4. VERIFICAR ÍNDICES PARA OPTIMIZACIÓN DE RLS
-- ============================================================================
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef,
  CASE
    WHEN indexname LIKE 'idx_users_tenant_agency%' THEN '✅ ÍNDICE OPTIMIZADO PARA RLS'
    WHEN indexname LIKE 'idx_users_role%' THEN '✅ ÍNDICE OPTIMIZADO PARA RLS'
    WHEN indexname = 'users_pkey' THEN '✅ ÍNDICE PRIMARY KEY'
    ELSE '⚠️ VERIFICAR UTILIDAD'
  END AS index_status
FROM pg_indexes
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY indexname;

-- ============================================================================
-- 5. VERIFICAR FUNCIONES HELPER USADAS POR LAS POLICIES
-- ============================================================================
SELECT
  proname AS function_name,
  pg_get_function_result(oid) AS return_type,
  pg_get_function_arguments(oid) AS arguments,
  CASE
    WHEN prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '⚠️ NO SECURITY DEFINER'
  END AS security_status
FROM pg_proc
WHERE proname IN (
  'is_owner',
  'is_superadmin',
  'get_user_role',
  'get_user_tenant_id',
  'get_user_agency_id',
  'can_create_user_with_role',
  'can_manage_user',
  'get_allowed_roles_for_creation'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- ============================================================================
-- 6. VERIFICAR DATOS EN LA TABLA USERS
-- ============================================================================
SELECT
  role,
  COUNT(*) AS user_count,
  COUNT(DISTINCT tenant_id) AS distinct_tenants,
  COUNT(DISTINCT agency_id) AS distinct_agencies
FROM public.users
GROUP BY role
ORDER BY
  CASE role::text
    WHEN 'OWNER' THEN 1
    WHEN 'SUPERADMIN' THEN 2
    WHEN 'ADMIN' THEN 3
    WHEN 'SELLER' THEN 4
    ELSE 5
  END;

-- ============================================================================
-- 7. DETECTAR USUARIOS SIN TENANT O AGENCY
-- ============================================================================
SELECT
  id,
  email,
  role,
  tenant_id,
  agency_id,
  CASE
    WHEN tenant_id IS NULL THEN '⚠️ SIN TENANT'
    WHEN agency_id IS NULL AND role != 'OWNER' THEN '⚠️ SIN AGENCY (no OWNER)'
    ELSE '✅ OK'
  END AS data_integrity_status
FROM public.users
WHERE tenant_id IS NULL OR (agency_id IS NULL AND role::text != 'OWNER')
ORDER BY role, email;

-- ============================================================================
-- 8. VERIFICAR VIEW users_with_details
-- ============================================================================
SELECT
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE viewname = 'users_with_details' AND schemaname = 'public';

-- ============================================================================
-- 9. RESUMEN DE SEGURIDAD Y RECOMENDACIONES
-- ============================================================================
DO $$
DECLARE
  rls_enabled boolean;
  temp_policy_count integer;
  production_policy_count integer;
  index_count integer;
  function_count integer;
BEGIN
  -- Verificar RLS
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE tablename = 'users' AND schemaname = 'public';

  -- Contar policies
  SELECT
    SUM(CASE WHEN policyname LIKE '%temp%' THEN 1 ELSE 0 END),
    SUM(CASE WHEN policyname LIKE 'users_%_policy' THEN 1 ELSE 0 END)
  INTO temp_policy_count, production_policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND schemaname = 'public';

  -- Contar índices
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'users'
    AND schemaname = 'public'
    AND indexname LIKE 'idx_users_%';

  -- Contar funciones
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN ('is_owner', 'get_user_role', 'can_create_user_with_role', 'can_manage_user')
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  -- Generar reporte
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 RESUMEN DE SEGURIDAD - TABLA USERS';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';

  IF NOT rls_enabled THEN
    RAISE NOTICE '❌ RLS STATUS: DESHABILITADO';
    RAISE NOTICE '   ⚠️  RIESGO CRÍTICO: Las policies no están activas';
    RAISE NOTICE '   ✅ ACCIÓN REQUERIDA: Ejecutar ALTER TABLE users ENABLE ROW LEVEL SECURITY';
  ELSE
    RAISE NOTICE '✅ RLS STATUS: HABILITADO';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '📋 POLICIES:';
  RAISE NOTICE '   - Productivas (users_*_policy): %', production_policy_count;
  RAISE NOTICE '   - Temporales (temp_*): %', temp_policy_count;

  IF temp_policy_count > 0 THEN
    RAISE NOTICE '   ⚠️  ACCIÓN REQUERIDA: Eliminar policies temporales';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '🔍 ÍNDICES OPTIMIZADOS: %', index_count;

  IF index_count < 2 THEN
    RAISE NOTICE '   ⚠️  Faltan índices para RLS, puede haber impacto en performance';
  ELSE
    RAISE NOTICE '   ✅ Índices adecuados para performance de RLS';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '🛠️  FUNCIONES HELPER: %', function_count;

  IF function_count < 4 THEN
    RAISE NOTICE '   ⚠️  Faltan funciones helper, las policies pueden fallar';
  ELSE
    RAISE NOTICE '   ✅ Funciones helper configuradas correctamente';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';

  IF NOT rls_enabled OR temp_policy_count > 0 THEN
    RAISE NOTICE '⚠️  RECOMENDACIÓN: EJECUTAR MIGRACIÓN INMEDIATAMENTE';
    RAISE NOTICE '   Ver archivo: ENABLE_RLS_MIGRATION.sql';
  ELSE
    RAISE NOTICE '✅ CONFIGURACIÓN CORRECTA - No se requiere acción';
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;
