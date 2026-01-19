-- ============================================================================
-- PASO 1: CORREGIR DATOS ANTES DE HABILITAR RLS
-- ============================================================================
-- IMPORTANTE: Este script DEBE ejecutarse ANTES de habilitar RLS
-- De lo contrario, las policies fallarán y bloquearán el acceso

BEGIN;

-- ============================================================================
-- 1. VERIFICAR ESTADO ACTUAL
-- ============================================================================

SELECT '🔍 Usuarios sin tenant_id:' AS status;
SELECT email, role, tenant_id, agency_id
FROM public.users
WHERE tenant_id IS NULL;

SELECT '🔍 Tenants existentes:' AS status;
SELECT id, name, status FROM public.tenants;

SELECT '🔍 Agencies existentes:' AS status;
SELECT id, name, tenant_id, status FROM public.agencies;

-- ============================================================================
-- 2. ASIGNAR TENANT_ID A USUARIOS SIN TENANT
-- ============================================================================

-- 2.1 Identificar o crear tenant principal
DO $$
DECLARE
  main_tenant_id uuid;
  demo_tenant_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Verificar si existe el tenant demo
  SELECT id INTO main_tenant_id
  FROM public.tenants
  WHERE id = demo_tenant_id;

  IF main_tenant_id IS NULL THEN
    -- Buscar el primer tenant disponible
    SELECT id INTO main_tenant_id
    FROM public.tenants
    WHERE status = 'active'
    LIMIT 1;
  END IF;

  IF main_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No hay tenants activos en la base de datos. Crea un tenant primero.';
  END IF;

  RAISE NOTICE '✅ Tenant principal identificado: %', main_tenant_id;

  -- 2.2 Asignar tenant_id al SUPERADMIN (mantiene su agency_id como NULL)
  UPDATE public.users
  SET tenant_id = main_tenant_id
  WHERE role = 'SUPERADMIN' AND tenant_id IS NULL;

  RAISE NOTICE '✅ SUPERADMIN actualizado con tenant_id';

  -- 2.3 Asignar tenant_id a ADMIN y SELLERS basado en su agency
  UPDATE public.users u
  SET tenant_id = (
    SELECT a.tenant_id
    FROM public.agencies a
    WHERE a.id = u.agency_id
  )
  WHERE u.role IN ('ADMIN', 'SELLER')
    AND u.tenant_id IS NULL
    AND u.agency_id IS NOT NULL;

  RAISE NOTICE '✅ ADMIN y SELLERS actualizados con tenant_id desde agencies';

  -- 2.4 CASO ESPECIAL: OWNER sin tenant (asignar al tenant principal)
  UPDATE public.users
  SET tenant_id = main_tenant_id
  WHERE role = 'OWNER' AND tenant_id IS NULL;

  RAISE NOTICE '✅ OWNER actualizado con tenant_id';

  -- 2.5 Verificar que no queden usuarios sin tenant
  IF EXISTS (SELECT 1 FROM public.users WHERE tenant_id IS NULL) THEN
    RAISE WARNING '⚠️ Todavía hay usuarios sin tenant_id. Revisa manualmente.';
  ELSE
    RAISE NOTICE '✅ Todos los usuarios tienen tenant_id asignado';
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFICAR INTEGRIDAD DE DATOS DESPUÉS DE LA CORRECCIÓN
-- ============================================================================

SELECT '✅ Verificación final - Usuarios por rol con tenant:' AS status;
SELECT
  role,
  COUNT(*) AS total,
  COUNT(DISTINCT tenant_id) AS distinct_tenants,
  COUNT(DISTINCT agency_id) AS distinct_agencies,
  SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) AS sin_tenant,
  SUM(CASE WHEN agency_id IS NULL AND role != 'OWNER' THEN 1 ELSE 0 END) AS sin_agency
FROM public.users
GROUP BY role
ORDER BY
  CASE role::text
    WHEN 'OWNER' THEN 1
    WHEN 'SUPERADMIN' THEN 2
    WHEN 'ADMIN' THEN 3
    WHEN 'SELLER' THEN 4
  END;

-- ============================================================================
-- 4. VERIFICAR AGENCIAS CON TENANT VÁLIDO
-- ============================================================================

SELECT '✅ Verificación - Agencies con tenant:' AS status;
SELECT
  a.id,
  a.name,
  a.tenant_id,
  t.name AS tenant_name,
  COUNT(u.id) AS user_count
FROM public.agencies a
LEFT JOIN public.tenants t ON a.tenant_id = t.id
LEFT JOIN public.users u ON u.agency_id = a.id
GROUP BY a.id, a.name, a.tenant_id, t.name;

COMMIT;

-- ============================================================================
-- SIGUIENTE PASO: Ejecutar ENABLE_RLS_MIGRATION.sql
-- ============================================================================
