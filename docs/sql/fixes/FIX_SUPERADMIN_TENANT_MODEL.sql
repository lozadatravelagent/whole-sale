-- =====================================================================
-- FIX CORRECTO: SUPERADMIN asignado a TENANT (no a agency)
-- =====================================================================
-- ARQUITECTURA CORRECTA:
-- - OWNER: Ve TODO el sistema
-- - SUPERADMIN: Asignado a un TENANT → Ve TODAS las agencias de ese tenant
-- - ADMIN: Asignado a una AGENCY → Ve solo esa agencia
-- - SELLER: Asignado a una AGENCY → Ve solo sus leads
-- =====================================================================

-- PASO 1: DIAGNÓSTICO - Ver configuración actual
SELECT
  u.email,
  u.role,
  u.tenant_id,
  t.name as tenant_name,
  u.agency_id,
  a.name as agency_name,
  CASE
    WHEN u.role = 'SUPERADMIN' AND u.tenant_id IS NULL THEN '❌ SUPERADMIN sin tenant'
    WHEN u.role = 'SUPERADMIN' AND u.tenant_id IS NOT NULL AND u.agency_id IS NULL THEN '✅ SUPERADMIN correcto (tenant sin agency)'
    WHEN u.role = 'SUPERADMIN' AND u.agency_id IS NOT NULL THEN '⚠️ SUPERADMIN con agency específica (debería ser NULL)'
    WHEN u.role = 'ADMIN' AND u.agency_id IS NULL THEN '❌ ADMIN sin agency'
    WHEN u.role = 'SELLER' AND u.agency_id IS NULL THEN '❌ SELLER sin agency'
    ELSE '✅ Configuración correcta'
  END as estado
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE u.email = 'superadmin@superadmin.com';

-- PASO 2: Ver tenants disponibles
SELECT
  id as tenant_id,
  name as tenant_name,
  status,
  created_at
FROM tenants
ORDER BY name;

-- PASO 3: Ver agencias de cada tenant
SELECT
  t.name as tenant_name,
  a.id as agency_id,
  a.name as agency_name,
  a.status,
  COUNT(u.id) as users_count
FROM tenants t
LEFT JOIN agencies a ON a.tenant_id = t.id
LEFT JOIN users u ON u.agency_id = a.id
GROUP BY t.id, t.name, a.id, a.name, a.status
ORDER BY t.name, a.name;

-- =====================================================================
-- PASO 4: CORREGIR SUPERADMIN - Asignar a TENANT (no a agency)
-- =====================================================================

-- Opción A: Si existe un tenant y quieres asignar superadmin a ese tenant
-- (Reemplaza 'Nombre del Tenant' con el nombre real)

UPDATE users
SET
  tenant_id = (SELECT id FROM tenants LIMIT 1),  -- Asignar al tenant
  agency_id = NULL  -- IMPORTANTE: SUPERADMIN NO tiene agency específica
WHERE email = 'superadmin@superadmin.com';

-- Opción B: Si NO hay tenants, crear uno primero
/*
INSERT INTO tenants (name, status)
VALUES ('Mi Tenant', 'active')
RETURNING id;

-- Luego asignar el SUPERADMIN a ese tenant
UPDATE users
SET
  tenant_id = (SELECT id FROM tenants WHERE name = 'Mi Tenant'),
  agency_id = NULL
WHERE email = 'superadmin@superadmin.com';
*/

-- =====================================================================
-- PASO 5: ACTUALIZAR POLÍTICA RLS (Modelo TENANT para SUPERADMIN)
-- =====================================================================

DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  -- 1. Puede ver sí mismo
  id = auth.uid()

  OR

  -- 2. OWNER ve todos
  public.is_owner()

  OR

  -- 3. SUPERADMIN ve usuarios de TODAS las agencias de SU TENANT
  (
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()  -- Mismo tenant
  )

  OR

  -- 4. ADMIN ve SELLERS de su agencia
  (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

-- Política INSERT
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    -- OWNER puede crear en cualquier tenant/agency
    public.is_owner()

    OR

    -- SUPERADMIN puede crear usuarios en agencias de SU TENANT
    (
      public.get_user_role() = 'SUPERADMIN'
      AND tenant_id = public.get_user_tenant_id()
    )

    OR

    -- ADMIN puede crear SELLERS en su agencia
    (
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);

-- Política UPDATE
DROP POLICY IF EXISTS "users_update_policy" ON public.users;

CREATE POLICY "users_update_policy" ON public.users FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR public.can_manage_user(id)
)
WITH CHECK (
  id = auth.uid()
  OR public.can_manage_user(id)
);

-- =====================================================================
-- PASO 6: VERIFICACIÓN
-- =====================================================================

-- 6.1: Verificar configuración de superadmin
SELECT
  u.email,
  u.role,
  t.name as tenant_assigned,
  u.agency_id as agency_should_be_null,
  CASE
    WHEN u.tenant_id IS NOT NULL AND u.agency_id IS NULL THEN '✅ CORRECTO'
    WHEN u.tenant_id IS NULL THEN '❌ Sin tenant asignado'
    WHEN u.agency_id IS NOT NULL THEN '⚠️ Tiene agency (debería ser NULL)'
  END as estado
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.email = 'superadmin@superadmin.com';

-- 6.2: Ver usuarios que DEBERÍA ver el SUPERADMIN (por tenant)
SELECT
  u.email,
  u.role,
  a.name as agency_name,
  t.name as tenant_name,
  CASE
    WHEN u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com') THEN '✅ Self'
    WHEN u.tenant_id = (SELECT tenant_id FROM users WHERE email = 'superadmin@superadmin.com') THEN '✅ Mismo tenant'
    ELSE '❌ Otro tenant'
  END as visibilidad
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE
  -- Self
  u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com')
  OR
  -- Mismo tenant
  u.tenant_id = (SELECT tenant_id FROM users WHERE email = 'superadmin@superadmin.com')
ORDER BY visibilidad, u.role, u.email;

-- 6.3: Contar usuarios por tenant
SELECT
  t.name as tenant_name,
  COUNT(u.id) as total_users,
  COUNT(u.id) FILTER (WHERE u.role = 'SUPERADMIN') as superadmins,
  COUNT(u.id) FILTER (WHERE u.role = 'ADMIN') as admins,
  COUNT(u.id) FILTER (WHERE u.role = 'SELLER') as sellers
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id
GROUP BY t.id, t.name
ORDER BY t.name;

-- =====================================================================
-- RESULTADO ESPERADO
-- =====================================================================
-- Después de este fix, superadmin@superadmin.com debería:
--
-- 1. Tener tenant_id asignado (ej: "Mi Tenant")
-- 2. Tener agency_id = NULL (no asignado a agencia específica)
-- 3. Ver TODOS los usuarios de TODAS las agencias de SU TENANT
-- 4. Ver usuarios de lozada agency SI está en su tenant
-- 5. Ver usuarios de Agency Team SI está en su tenant
-- 6. NO ver usuarios de otros tenants
-- =====================================================================

SELECT '✅ FIX APLICADO - MODELO TENANT PARA SUPERADMIN' as resultado;
