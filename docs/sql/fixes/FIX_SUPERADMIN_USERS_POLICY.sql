-- ============================================================================
-- FIX: Actualizar política RLS de users para SUPERADMIN (Modelo TENANT-based)
-- ============================================================================

-- Este script corrige la política SELECT de users para que SUPERADMIN
-- vea TODOS los usuarios de su TENANT (no solo de una agencia)

-- ============================================================================
-- PASO 1: Actualizar política SELECT de users
-- ============================================================================

DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid() -- Can see self
  OR public.is_owner() -- OWNER sees all
  OR (
    -- ✅ SUPERADMIN ve TODOS los usuarios de su TENANT (todas las agencias)
    public.get_user_role() = 'SUPERADMIN'
    AND tenant_id = public.get_user_tenant_id()
  )
  OR (
    -- ADMIN ve solo SELLERS de su agencia
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

-- ============================================================================
-- PASO 2: Actualizar política INSERT de users
-- ============================================================================

DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    -- OWNER puede crear en cualquier tenant/agency
    public.is_owner()
    OR (
      -- ✅ SUPERADMIN puede crear en CUALQUIER agencia de su tenant
      public.get_user_role() = 'SUPERADMIN'
      AND tenant_id = public.get_user_tenant_id()
    )
    OR (
      -- ADMIN puede crear SELLERS en su agencia
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);

-- ============================================================================
-- PASO 3: Actualizar función can_manage_user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_manage_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role public.user_role;
  current_user_tenant_id uuid;
  current_user_agency_id uuid;
  target_user_tenant_id uuid;
  target_user_agency_id uuid;
  target_user_role public.user_role;
BEGIN
  -- Get current user info
  SELECT role, tenant_id, agency_id INTO current_user_role, current_user_tenant_id, current_user_agency_id
  FROM public.users
  WHERE id = auth.uid();

  -- Get target user info
  SELECT role, tenant_id, agency_id INTO target_user_role, target_user_tenant_id, target_user_agency_id
  FROM public.users
  WHERE id = target_user_id;

  -- OWNER can manage anyone
  IF current_user_role = 'OWNER' THEN
    RETURN true;
  END IF;

  -- ✅ SUPERADMIN puede gestionar usuarios de su TENANT (excepto OWNERs)
  IF current_user_role = 'SUPERADMIN' AND target_user_role != 'OWNER' THEN
    RETURN current_user_tenant_id = target_user_tenant_id;
  END IF;

  -- ADMIN can manage SELLERS in their agency
  IF current_user_role = 'ADMIN' AND target_user_role = 'SELLER' THEN
    RETURN current_user_agency_id = target_user_agency_id;
  END IF;

  -- Default: cannot manage
  RETURN false;
END;
$$;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- 1. Ver política activa
SELECT
  polname as policyname,
  pg_get_expr(polqual, polrelid) as policy_definition
FROM pg_policy
WHERE polname = 'users_select_policy'
  AND polrelid = 'public.users'::regclass;

-- 2. Ver usuarios actuales por tenant
SELECT
  t.name as tenant,
  u.role,
  u.email,
  a.name as agency
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN agencies a ON u.agency_id = a.id
ORDER BY t.name, u.role;

-- ============================================================================
-- NOTA IMPORTANTE
-- ============================================================================

/*
Con este fix:

✅ SUPERADMIN con tenant_id = 'X' y agency_id = NULL
   → Ve TODOS los usuarios donde tenant_id = 'X' (todas las agencias)

✅ ADMIN con agency_id = 'Y'
   → Ve solo SELLERS donde agency_id = 'Y' (su agencia)

✅ SELLER
   → Solo se ve a sí mismo

Este es el MODELO CORRECTO (TENANT-based) según tu documentación.
*/
