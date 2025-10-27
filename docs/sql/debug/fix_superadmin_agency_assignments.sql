-- =====================================================================
-- DIAGNÓSTICO Y CORRECCIÓN: Asignaciones de SUPERADMIN a Agencias
-- =====================================================================
-- Este script diagnostica y corrige el problema donde un SUPERADMIN
-- ve usuarios de agencias a las que NO está asignado.
--
-- PROBLEMA IDENTIFICADO:
-- - La migración 20251005100000_superadmin_multiple_agencies.sql creó
--   una tabla de asignaciones (superadmin_agency_assignments)
-- - La política RLS usa get_superadmin_agency_ids() que busca en esa tabla
-- - Si NO hay asignaciones, el SUPERADMIN no debería ver usuarios
-- - PERO la política anterior usaba users.agency_id directamente
-- =====================================================================

-- 1. DIAGNÓSTICO: Ver SUPERADMIN actual y su configuración
SELECT
  u.id,
  u.email,
  u.role,
  u.agency_id as agency_id_in_users_table,
  a.name as agency_name_from_users_table,
  u.tenant_id,
  t.name as tenant_name
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.role = 'SUPERADMIN';

-- 2. DIAGNÓSTICO: Ver asignaciones existentes en superadmin_agency_assignments
SELECT
  saa.id,
  saa.superadmin_id,
  u.email as superadmin_email,
  saa.agency_id,
  a.name as agency_name,
  saa.assigned_at
FROM superadmin_agency_assignments saa
JOIN users u ON saa.superadmin_id = u.id
JOIN agencies a ON saa.agency_id = a.id;

-- 3. DIAGNÓSTICO: Usuarios que está viendo el SUPERADMIN (según RLS actual)
-- Nota: Esta query simula lo que vería superadmin@superadmin.com
SELECT
  u.id,
  u.email,
  u.role,
  u.agency_id,
  a.name as agency_name
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE
  -- Simula la política RLS users_select_policy
  u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') -- Self
  OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') AND role = 'OWNER') -- If OWNER
  OR (
    -- SUPERADMIN sees users in assigned agencies
    EXISTS (SELECT 1 FROM users WHERE id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') AND role = 'SUPERADMIN')
    AND u.agency_id = ANY(
      SELECT agency_id
      FROM superadmin_agency_assignments
      WHERE superadmin_id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com')
    )
  );

-- 4. PROBLEMA IDENTIFICADO:
-- Si superadmin@superadmin.com tiene agency_id = 'lozada-agency-id' en la tabla users
-- PERO no tiene registros en superadmin_agency_assignments,
-- entonces get_superadmin_agency_ids() retorna ARRAY[] (vacío)
-- y la política RLS no le deja ver a nadie (excepto sí mismo)

-- 5. OPCIONES DE CORRECCIÓN:

-- OPCIÓN A: Migrar el agency_id de users.agency_id a superadmin_agency_assignments
-- (Recomendado si quieres usar el sistema de asignaciones múltiples)

DO $$
DECLARE
  superadmin_record RECORD;
BEGIN
  -- Para cada SUPERADMIN que tiene agency_id pero NO tiene asignaciones
  FOR superadmin_record IN
    SELECT u.id as superadmin_id, u.agency_id, u.email
    FROM users u
    WHERE u.role = 'SUPERADMIN'
      AND u.agency_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM superadmin_agency_assignments saa
        WHERE saa.superadmin_id = u.id
      )
  LOOP
    -- Crear la asignación en superadmin_agency_assignments
    INSERT INTO superadmin_agency_assignments (superadmin_id, agency_id, assigned_by)
    VALUES (
      superadmin_record.superadmin_id,
      superadmin_record.agency_id,
      (SELECT id FROM users WHERE role = 'OWNER' LIMIT 1) -- Asignado por el OWNER
    )
    ON CONFLICT (superadmin_id, agency_id) DO NOTHING;

    RAISE NOTICE 'Asignado SUPERADMIN % a agencia %',
      superadmin_record.email,
      superadmin_record.agency_id;
  END LOOP;
END;
$$;

-- OPCIÓN B: Revertir a la política RLS anterior que usa users.agency_id directamente
-- (Usar solo si NO quieres el sistema de asignaciones múltiples)

/*
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
*/

-- 6. VERIFICACIÓN POST-CORRECCIÓN:
-- Después de ejecutar OPCIÓN A o B, verifica que funcione:

SELECT
  'SUPERADMIN' as usuario,
  u.email,
  ARRAY_AGG(a.name) as agencias_asignadas
FROM users u
JOIN superadmin_agency_assignments saa ON u.id = saa.superadmin_id
JOIN agencies a ON saa.agency_id = a.agency_id
WHERE u.role = 'SUPERADMIN'
GROUP BY u.id, u.email;

-- 7. VERIFICACIÓN: Usuarios visibles para superadmin@superadmin.com
-- Esta query debería mostrar solo usuarios de "lozada agency"

WITH superadmin_agencies AS (
  SELECT agency_id
  FROM superadmin_agency_assignments
  WHERE superadmin_id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com')
)
SELECT
  u.email,
  u.role,
  a.name as agency_name,
  CASE
    WHEN u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') THEN 'Self'
    WHEN u.agency_id = ANY(SELECT agency_id FROM superadmin_agencies) THEN 'Assigned Agency'
    ELSE 'SHOULD NOT SEE THIS!'
  END as reason
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id;

-- =====================================================================
-- RESUMEN DE LA CORRECCIÓN
-- =====================================================================
--
-- CAUSA DEL PROBLEMA:
-- 1. Migración 20251005100000 implementó asignaciones múltiples
-- 2. RLS policy usa get_superadmin_agency_ids() que busca en superadmin_agency_assignments
-- 3. superadmin@superadmin.com tiene agency_id='lozada' en users.agency_id
-- 4. PERO no tiene registros en superadmin_agency_assignments
-- 5. Por lo tanto get_superadmin_agency_ids() retorna []
-- 6. La política RLS falla y NO filtra correctamente
--
-- SOLUCIÓN APLICADA (Opción A):
-- - Migrar agency_id de users.agency_id a superadmin_agency_assignments
-- - Esto sincroniza el modelo antiguo con el nuevo
-- - Permite asignaciones múltiples en el futuro
--
-- ALTERNATIVA (Opción B):
-- - Revertir la política RLS a usar users.agency_id directamente
-- - Más simple pero pierde funcionalidad de asignaciones múltiples
-- =====================================================================
