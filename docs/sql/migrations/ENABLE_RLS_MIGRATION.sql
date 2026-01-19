-- ============================================================================
-- PASO 2: HABILITAR RLS Y LIMPIAR POLICIES OBSOLETAS
-- ============================================================================
-- PREREQUISITO: Ejecutar FIX_DATA_BEFORE_RLS.sql primero
-- IMPACTO: CRÍTICO - Cambia el modelo de seguridad de la aplicación
-- TIEMPO ESTIMADO: 2 minutos
-- REVERSIBLE: Sí (ver sección ROLLBACK al final)

BEGIN;

-- ============================================================================
-- 1. VERIFICAR PREREQUISITOS
-- ============================================================================

DO $$
DECLARE
  users_without_tenant integer;
  rls_status boolean;
BEGIN
  -- Verificar que todos los usuarios tienen tenant_id
  SELECT COUNT(*) INTO users_without_tenant
  FROM public.users
  WHERE tenant_id IS NULL;

  IF users_without_tenant > 0 THEN
    RAISE EXCEPTION '❌ ABORTAR: % usuarios sin tenant_id. Ejecuta FIX_DATA_BEFORE_RLS.sql primero', users_without_tenant;
  END IF;

  -- Verificar estado actual de RLS
  SELECT rowsecurity INTO rls_status
  FROM pg_tables
  WHERE tablename = 'users' AND schemaname = 'public';

  IF rls_status THEN
    RAISE WARNING '⚠️ RLS ya está habilitado en la tabla users. Continuando con limpieza de policies...';
  ELSE
    RAISE NOTICE '✅ Prerequisitos verificados. Procediendo con migración...';
  END IF;
END $$;

-- ============================================================================
-- 2. ELIMINAR POLICY TEMPORAL PELIGROSA
-- ============================================================================

DROP POLICY IF EXISTS "temp_dev_policy_all_users" ON public.users;
RAISE NOTICE '✅ Policy temporal eliminada: temp_dev_policy_all_users';

-- ============================================================================
-- 3. ELIMINAR POLICIES ANTIGUAS DUPLICADAS
-- ============================================================================

DROP POLICY IF EXISTS "owner can manage all users" ON public.users;
DROP POLICY IF EXISTS "owner can select all users" ON public.users;
RAISE NOTICE '✅ Policies antiguas eliminadas';

-- Eliminar otras policies obsoletas si existen
DROP POLICY IF EXISTS "superadmins can manage users in tenant" ON public.users;
DROP POLICY IF EXISTS "user can select self" ON public.users;
DROP POLICY IF EXISTS "user can update self" ON public.users;
DROP POLICY IF EXISTS "superadmins can select users in tenant" ON public.users;
DROP POLICY IF EXISTS "superadmins can insert users" ON public.users;
DROP POLICY IF EXISTS "superadmins can update users in tenant" ON public.users;
DROP POLICY IF EXISTS "superadmins can delete users in tenant" ON public.users;

-- ============================================================================
-- 4. VERIFICAR QUE EXISTEN LAS 4 POLICIES PRODUCTIVAS
-- ============================================================================

DO $$
DECLARE
  policy_count integer;
  missing_policies text[];
BEGIN
  -- Verificar cada policy requerida
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_select_policy') THEN
    missing_policies := array_append(missing_policies, 'users_select_policy');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_insert_policy') THEN
    missing_policies := array_append(missing_policies, 'users_insert_policy');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_update_policy') THEN
    missing_policies := array_append(missing_policies, 'users_update_policy');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_delete_policy') THEN
    missing_policies := array_append(missing_policies, 'users_delete_policy');
  END IF;

  IF array_length(missing_policies, 1) > 0 THEN
    RAISE EXCEPTION '❌ ABORTAR: Faltan policies productivas: %. Ejecuta la migración 20251005000002_user_management_helpers.sql primero', missing_policies;
  END IF;

  RAISE NOTICE '✅ Las 4 policies productivas existen correctamente';
END $$;

-- ============================================================================
-- 5. HABILITAR ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

RAISE NOTICE '✅ RLS HABILITADO en tabla users';
RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════';
RAISE NOTICE '🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE';
RAISE NOTICE '═══════════════════════════════════════════════════════';

-- ============================================================================
-- 6. VERIFICAR ESTADO FINAL
-- ============================================================================

DO $$
DECLARE
  rls_status boolean;
  policy_count integer;
  temp_policy_count integer;
BEGIN
  -- Verificar RLS
  SELECT rowsecurity INTO rls_status
  FROM pg_tables
  WHERE tablename = 'users' AND schemaname = 'public';

  -- Contar policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND schemaname = 'public';

  SELECT COUNT(*) INTO temp_policy_count
  FROM pg_policies
  WHERE tablename = 'users' AND schemaname = 'public'
    AND policyname LIKE '%temp%';

  RAISE NOTICE '';
  RAISE NOTICE '📊 ESTADO FINAL:';
  RAISE NOTICE '   - RLS habilitado: %', rls_status;
  RAISE NOTICE '   - Total policies: %', policy_count;
  RAISE NOTICE '   - Policies temporales: %', temp_policy_count;
  RAISE NOTICE '';

  IF NOT rls_status THEN
    RAISE EXCEPTION '❌ ERROR: RLS no se habilitó correctamente';
  END IF;

  IF temp_policy_count > 0 THEN
    RAISE WARNING '⚠️ ADVERTENCIA: Todavía existen policies temporales';
  END IF;

  IF policy_count = 4 THEN
    RAISE NOTICE '✅ CONFIGURACIÓN PERFECTA: Solo 4 policies productivas activas';
  ELSIF policy_count > 4 THEN
    RAISE WARNING '⚠️ ADVERTENCIA: Hay % policies (esperadas 4). Revisa duplicados.', policy_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRACIÓN: TESTS RECOMENDADOS
-- ============================================================================

-- Test 1: Verificar que RLS está activo
SELECT
  tablename,
  rowsecurity AS rls_enabled,
  CASE WHEN rowsecurity THEN '✅ ACTIVO' ELSE '❌ INACTIVO' END AS status
FROM pg_tables
WHERE tablename = 'users' AND schemaname = 'public';

-- Test 2: Listar policies activas
SELECT
  policyname,
  cmd AS operation,
  roles
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

-- Test 3: Verificar usuarios con datos correctos
SELECT
  role,
  COUNT(*) AS total,
  COUNT(DISTINCT tenant_id) AS tenants,
  SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) AS sin_tenant
FROM public.users
GROUP BY role;

-- ============================================================================
-- ROLLBACK (solo en caso de emergencia)
-- ============================================================================

-- Si algo sale mal y necesitas revertir INMEDIATAMENTE:
--
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
--
-- IMPORTANTE: Esto dejará la aplicación SIN seguridad multi-tenant.
-- Solo usar si hay un problema crítico que impide el acceso.
-- Después de hacer rollback, investiga el problema antes de reintentar.

-- ============================================================================
-- SIGUIENTE PASO: TESTING EN LA APLICACIÓN
-- ============================================================================
-- 1. Login como SUPERADMIN → Verificar que NO ve usuarios OWNER
-- 2. Login como ADMIN → Verificar que solo ve SELLERS de su agencia
-- 3. Login como OWNER → Verificar que ve todos los usuarios
-- 4. Crear usuario como SUPERADMIN → Debe funcionar
-- 5. Intentar crear OWNER como SUPERADMIN → Debe fallar
