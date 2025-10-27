-- =====================================================================
-- FIX URGENTE: SUPERADMIN ve usuarios incorrectos
-- =====================================================================
-- PROBLEMA REAL IDENTIFICADO:
-- - La tabla superadmin_agency_assignments NO EXISTE en la BD remota
-- - Pero la política RLS SÍ está intentando usar esa tabla
-- - Por eso falla y muestra usuarios incorrectos
--
-- SOLUCIÓN: Revertir a la política RLS que usa users.agency_id
-- =====================================================================

-- 1. VERIFICAR PROBLEMA: Intentar consultar la tabla
-- (Esta query fallará si la tabla NO existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'superadmin_agency_assignments'
  ) THEN
    RAISE NOTICE '❌ PROBLEMA CONFIRMADO: La tabla superadmin_agency_assignments NO EXISTE';
  ELSE
    RAISE NOTICE '✅ La tabla superadmin_agency_assignments SÍ existe';
  END IF;
END $$;

-- 2. VERIFICAR POLÍTICA RLS ACTUAL
SELECT
  polname as policyname,
  pg_get_expr(polqual, polrelid) as policy_definition
FROM pg_policy
WHERE polname = 'users_select_policy'
  AND polrelid = 'public.users'::regclass;

-- 3. SOLUCIÓN: Revertir a política RLS simple (usa users.agency_id)
-- Esta política funciona sin necesidad de tablas adicionales

DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid() -- Can see self
  OR public.is_owner() -- OWNER sees all
  OR (
    -- SUPERADMIN sees users in their agency (using users.agency_id)
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = public.get_user_agency_id()
  )
  OR (
    -- ADMIN sees sellers in their agency
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

-- 4. ACTUALIZAR TAMBIÉN LA POLÍTICA INSERT (por consistencia)
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    -- OWNER can create in any tenant/agency
    public.is_owner()
    OR (
      -- SUPERADMIN can create in their agency
      public.get_user_role() = 'SUPERADMIN'
      AND agency_id = public.get_user_agency_id()
    )
    OR (
      -- ADMIN can create SELLERS in their agency
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);

-- 5. VERIFICACIÓN: Comprobar que la política se aplicó correctamente
SELECT
  'users_select_policy' as policy_name,
  pg_get_expr(polqual, polrelid) as current_definition
FROM pg_policy
WHERE polname = 'users_select_policy'
  AND polrelid = 'public.users'::regclass;

-- Debería mostrar algo como:
-- ((id = auth.uid()) OR public.is_owner() OR ((public.get_user_role() = 'SUPERADMIN'::user_role) AND (agency_id = public.get_user_agency_id())) OR ...)

-- 6. PRUEBA: Verificar usuarios visibles para superadmin@superadmin.com
-- Ejecuta esto DESPUÉS de aplicar el fix
SELECT
  u.email,
  u.role,
  a.name as agency_name,
  CASE
    WHEN u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') THEN '✅ Self (siempre visible)'
    WHEN u.agency_id = (SELECT agency_id FROM users WHERE email = 'superadmin@superadmin.com') THEN '✅ Same agency (debería ver)'
    ELSE '❌ Otra agencia (NO debería ver)'
  END as visibilidad
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
ORDER BY
  CASE
    WHEN u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') THEN 1
    WHEN u.agency_id = (SELECT agency_id FROM users WHERE email = 'superadmin@superadmin.com') THEN 2
    ELSE 3
  END,
  u.role;

-- =====================================================================
-- RESULTADO ESPERADO DESPUÉS DEL FIX
-- =====================================================================
-- superadmin@superadmin.com (asignado a "lozada agency") debería ver:
--
-- ✅ superadmin@superadmin.com | SUPERADMIN | lozada agency | ✅ Self
-- ✅ user1@lozada.com          | ADMIN      | lozada agency | ✅ Same agency
-- ✅ user2@lozada.com          | SELLER     | lozada agency | ✅ Same agency
--
-- ❌ NO debería ver:
-- ❌ agency@agency.com         | ADMIN      | Agency Team   | ❌ Otra agencia
-- ❌ seller@seller.com         | SELLER     | Agency Team   | ❌ Otra agencia
-- ❌ seller2@seller2.com       | SELLER     | Agency Team   | ❌ Otra agencia
-- =====================================================================

-- 7. LIMPIEZA (OPCIONAL): Eliminar funciones/tablas no usadas
-- Solo ejecutar si estás SEGURO de que no necesitas asignaciones múltiples

/*
-- Eliminar función que busca en tabla inexistente
DROP FUNCTION IF EXISTS public.get_superadmin_agency_ids() CASCADE;

-- Si la tabla existe (en caso de que se creó parcialmente), eliminarla
DROP TABLE IF EXISTS public.superadmin_agency_assignments CASCADE;

-- Eliminar vista si existe
DROP VIEW IF EXISTS public.superadmin_agencies_view CASCADE;
*/

-- =====================================================================
-- RESUMEN DE LA SOLUCIÓN
-- =====================================================================
--
-- PROBLEMA RAÍZ:
-- 1. Migración 20251005100000_superadmin_multiple_agencies.sql NO se aplicó
-- 2. Tabla superadmin_agency_assignments NO existe
-- 3. PERO alguna política RLS SÍ intenta usar esa tabla
-- 4. Resultado: RLS falla y muestra usuarios incorrectos
--
-- SOLUCIÓN APLICADA:
-- 1. Revertir política RLS a usar users.agency_id (modelo simple)
-- 2. No requiere tabla adicional
-- 3. SUPERADMIN ve solo usuarios de SU agencia (users.agency_id)
-- 4. Funciona inmediatamente sin migraciones de datos
--
-- ALTERNATIVA FUTURA:
-- - Si quieres asignaciones múltiples:
--   1. Aplicar migración 20251005100000_superadmin_multiple_agencies.sql
--   2. Crear tabla superadmin_agency_assignments
--   3. Migrar datos de users.agency_id a la nueva tabla
--   4. Usar política RLS con get_superadmin_agency_ids()
-- =====================================================================

-- FIN DEL SCRIPT
SELECT '✅ FIX APLICADO: Política RLS revertida a modelo simple (users.agency_id)' as resultado;
