-- =====================================================================
-- FIX: Corregir inconsistencias de tenant_id en usuarios
-- =====================================================================
-- PROBLEMA: Usuarios (ADMIN/SELLER) tienen agency_id pero NO tenant_id
-- SOLUCIÓN: Heredar tenant_id de la agencia a la que pertenecen
-- =====================================================================

-- PASO 1: DIAGNÓSTICO COMPLETO
SELECT
  '=== DIAGNÓSTICO: Usuarios con problemas ===' as info;

SELECT
  u.email,
  u.role,
  u.tenant_id as user_tenant,
  u.agency_id as user_agency,
  a.name as agency_name,
  a.tenant_id as agency_tenant,
  CASE
    WHEN u.tenant_id IS NULL AND u.agency_id IS NOT NULL THEN '❌ CRÍTICO: Sin tenant pero con agency'
    WHEN u.tenant_id != a.tenant_id THEN '❌ INCONSISTENTE: User tenant != Agency tenant'
    WHEN u.role IN ('ADMIN', 'SELLER') AND u.tenant_id IS NULL THEN '❌ Sin tenant'
    WHEN u.role IN ('ADMIN', 'SELLER') AND u.agency_id IS NULL THEN '❌ Sin agency'
    ELSE '✅ OK'
  END as problema
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE u.role != 'OWNER'  -- OWNER no tiene tenant/agency
ORDER BY problema DESC, u.role;

-- =====================================================================
-- PASO 2: CORRECCIÓN AUTOMÁTICA
-- =====================================================================
-- Heredar tenant_id de la agencia para usuarios que:
-- - Tienen agency_id asignado
-- - NO tienen tenant_id (NULL)
-- - O tienen tenant_id diferente al de su agencia

SELECT
  '=== CORRECCIÓN: Asignando tenant_id desde agencia ===' as info;

UPDATE users u
SET tenant_id = a.tenant_id
FROM agencies a
WHERE u.agency_id = a.id
  AND (
    u.tenant_id IS NULL  -- Sin tenant
    OR u.tenant_id != a.tenant_id  -- Tenant inconsistente
  )
  AND u.role IN ('ADMIN', 'SELLER', 'SUPERADMIN')  -- No tocar OWNER
RETURNING
  u.email,
  u.role,
  a.name as agency_name,
  u.tenant_id as nuevo_tenant_id;

-- =====================================================================
-- PASO 3: VERIFICACIÓN POST-CORRECCIÓN
-- =====================================================================

SELECT
  '=== VERIFICACIÓN: Estado después de la corrección ===' as info;

SELECT
  u.email,
  u.role,
  t.name as tenant_name,
  a.name as agency_name,
  CASE
    WHEN u.role = 'OWNER' AND u.tenant_id IS NULL AND u.agency_id IS NULL THEN '✅ OWNER'
    WHEN u.role = 'SUPERADMIN' AND u.tenant_id IS NOT NULL AND u.agency_id IS NULL THEN '✅ SUPERADMIN'
    WHEN u.role = 'ADMIN' AND u.tenant_id IS NOT NULL AND u.agency_id IS NOT NULL AND u.tenant_id = a.tenant_id THEN '✅ ADMIN'
    WHEN u.role = 'SELLER' AND u.tenant_id IS NOT NULL AND u.agency_id IS NOT NULL AND u.tenant_id = a.tenant_id THEN '✅ SELLER'
    ELSE '❌ AÚN CON PROBLEMAS'
  END as estado
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN agencies a ON u.agency_id = a.id
ORDER BY
  CASE u.role
    WHEN 'OWNER' THEN 1
    WHEN 'SUPERADMIN' THEN 2
    WHEN 'ADMIN' THEN 3
    WHEN 'SELLER' THEN 4
  END,
  u.email;

-- =====================================================================
-- PASO 4: VERIFICAR QUE SUPERADMIN VE USUARIOS CORRECTOS
-- =====================================================================

SELECT
  '=== VERIFICACIÓN: Usuarios visibles para superadmin@superadmin.com ===' as info;

SELECT
  u.email,
  u.role,
  a.name as agency_name,
  t.name as tenant_name,
  CASE
    WHEN u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') THEN '✅ Self'
    WHEN u.tenant_id = (SELECT tenant_id FROM users WHERE email = 'superadmin@superadmin.com') THEN '✅ Mismo tenant'
    WHEN u.role = 'OWNER' THEN '⚠️ OWNER (no debería ver en frontend)'
    ELSE '❌ Otro tenant (NO debería ver)'
  END as visibilidad
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE
  -- Self
  u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com')
  OR
  -- Mismo tenant (política RLS)
  u.tenant_id = (SELECT tenant_id FROM users WHERE email = 'superadmin@superadmin.com')
ORDER BY visibilidad, u.role;

-- =====================================================================
-- RESULTADO ESPERADO
-- =====================================================================
-- Después de este fix:
--
-- 1. agency@agency.com (ADMIN):
--    - tenant_id = tenant de "Agency Team" ✅
--    - agency_id = "Agency Team" ✅
--
-- 2. seller2@seller2.com (SELLER):
--    - tenant_id = tenant de "Agency Team" ✅
--    - agency_id = "Agency Team" ✅
--
-- 3. seller@seller.com (SELLER):
--    - tenant_id = tenant de "Agency Team" ✅ (verificado)
--    - agency_id = "Agency Team" ✅
--
-- 4. superadmin@superadmin.com debería ver:
--    - ✅ Todos los usuarios del tenant "Tenant Demo"
--    - ⚠️ Puede ver OWNER en RLS (pero frontend debería ocultarlo)
-- =====================================================================

SELECT '✅ CORRECCIÓN COMPLETADA' as resultado;
