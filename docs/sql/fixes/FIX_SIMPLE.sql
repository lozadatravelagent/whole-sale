-- =====================================================================
-- FIX SIMPLE: Corregir política RLS para SUPERADMIN
-- =====================================================================
-- Ejecuta este script completo en Supabase SQL Editor
-- =====================================================================

-- PASO 1: Revertir política SELECT
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_owner()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = public.get_user_agency_id()
  )
  OR (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

-- PASO 2: Revertir política INSERT
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

CREATE POLICY "users_insert_policy" ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_user_with_role(role)
  AND (
    public.is_owner()
    OR (
      public.get_user_role() = 'SUPERADMIN'
      AND agency_id = public.get_user_agency_id()
    )
    OR (
      public.get_user_role() = 'ADMIN'
      AND agency_id = public.get_user_agency_id()
      AND role = 'SELLER'::public.user_role
    )
  )
);

-- PASO 3: Verificar que se aplicó
SELECT '✅ FIX APLICADO CORRECTAMENTE' as resultado;

-- PASO 4: Verificar usuarios visibles (EJECUTAR DESPUÉS DEL FIX)
-- Descomenta las siguientes líneas para verificar:
/*
SELECT
  u.email,
  u.role,
  a.name as agency_name
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE u.agency_id = (SELECT agency_id FROM users WHERE email = 'superadmin@superadmin.com')
   OR u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com');
*/
