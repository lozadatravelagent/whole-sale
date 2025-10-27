-- =====================================================================
-- FIX: Asignar agency_id a superadmin@superadmin.com
-- =====================================================================
-- PROBLEMA REAL: superadmin@superadmin.com tiene agency_id = NULL
-- Por eso la política RLS no funciona correctamente
-- =====================================================================

-- PASO 1: DIAGNÓSTICO - Ver estado actual
SELECT
  email,
  role,
  agency_id,
  tenant_id,
  CASE
    WHEN agency_id IS NULL THEN '❌ SIN AGENCIA ASIGNADA'
    ELSE '✅ Tiene agencia'
  END as estado
FROM users
WHERE email = 'superadmin@superadmin.com';

-- PASO 2: Ver agencias disponibles para asignar
SELECT
  id as agency_id,
  name as agency_name,
  tenant_id,
  status
FROM agencies
ORDER BY name;

-- =====================================================================
-- PASO 3: ASIGNAR "lozada agency" a superadmin@superadmin.com
-- =====================================================================
-- IMPORTANTE: Reemplaza 'AGENCY_ID_DE_LOZADA' con el ID real de la agencia
-- Lo obtendrás de la query anterior (PASO 2)

-- Ejemplo:
-- UPDATE users
-- SET agency_id = 'abc-123-lozada-uuid'  -- ID real de lozada agency
-- WHERE email = 'superadmin@superadmin.com';

-- Versión automática (busca por nombre):
UPDATE users
SET agency_id = (
  SELECT id FROM agencies WHERE name = 'lozada agency' LIMIT 1
)
WHERE email = 'superadmin@superadmin.com';

-- PASO 4: Verificar que se asignó correctamente
SELECT
  u.email,
  u.role,
  u.agency_id,
  a.name as agency_name,
  a.status as agency_status,
  CASE
    WHEN u.agency_id IS NOT NULL THEN '✅ ASIGNADO CORRECTAMENTE'
    ELSE '❌ AÚN SIN AGENCIA'
  END as resultado
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE u.email = 'superadmin@superadmin.com';

-- PASO 5: Verificar usuarios visibles AHORA
SELECT
  u.email,
  u.role,
  a.name as agency_name,
  CASE
    WHEN u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') THEN '✅ Self'
    WHEN u.agency_id = (SELECT agency_id FROM users WHERE email = 'superadmin@superadmin.com') THEN '✅ Same agency'
    ELSE '❌ Otra agencia'
  END as visibilidad
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE u.agency_id = (SELECT agency_id FROM users WHERE email = 'superadmin@superadmin.com')
   OR u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com')
ORDER BY visibilidad;

-- =====================================================================
-- RESULTADO ESPERADO
-- =====================================================================
-- Después de ejecutar este script, superadmin@superadmin.com debería:
-- 1. Tener agency_id asignado (lozada agency)
-- 2. Ver solo usuarios de lozada agency en /users
-- 3. NO ver usuarios de Agency Team
-- =====================================================================

SELECT '✅ ASIGNACIÓN COMPLETADA' as resultado;
