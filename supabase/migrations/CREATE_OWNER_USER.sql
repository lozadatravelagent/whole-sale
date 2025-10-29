-- ============================================================
-- Script para crear usuario OWNER (Bootstrap)
-- ============================================================
-- Este script debe ejecutarse directamente en Supabase SQL Editor
-- con permisos de administrador (bypass RLS)
-- ============================================================

-- INSTRUCCIONES:
-- 1. Edita las variables abajo (email, password, name)
-- 2. Ejecuta este script en Supabase SQL Editor
-- 3. Cambia la contraseña después del primer login

-- ⚠️ IMPORTANTE: Reemplaza estos valores antes de ejecutar
\set owner_email 'owner@owner.com'  -- Cambia este email
\set owner_password '12345678'   -- Cambia esta contraseña (mínimo 8 caracteres)
\set owner_name 'Owner owner'       -- Cambia este nombre

-- ============================================================
-- PASO 1: Crear usuario en auth.users (Supabase Auth)
-- ============================================================
-- Nota: Esto debe hacerse usando la API de Supabase Auth Admin
-- o desde el Dashboard de Supabase > Authentication > Add User
--
-- Alternativamente, puedes usar este script en psql con permisos:
--
-- DO $$
-- DECLARE
--   new_user_id uuid;
-- BEGIN
--   -- Crear usuario en auth.users usando extensiones de Supabase
--   -- Esto requiere permisos especiales, mejor usa el Dashboard
-- END $$;

-- ============================================================
-- PASO 2: Una vez que tengas el user_id del auth.users:
-- ============================================================
-- Reemplaza el UUID abajo con el ID del usuario creado en auth.users

-- Obtener el ID del usuario recién creado desde auth.users:
-- SELECT id FROM auth.users WHERE email = 'owner@tusistema.com';

-- Luego ejecuta esto con el ID obtenido:

-- ============================================================
-- PASO 2A: Crear registro en public.users
-- ============================================================
-- Reemplaza 'TU_USER_ID_AQUI' con el ID real del usuario de auth.users
INSERT INTO public.users (
  id,
  email,
  name,
  role,
  agency_id,
  tenant_id,
  provider,
  created_at,
  updated_at
)
VALUES (
  'TU_USER_ID_AQUI'::uuid,  -- ⚠️ REEMPLAZA CON EL ID REAL de auth.users
  :'owner_email',
  :'owner_name',
  'OWNER'::public.user_role,
  NULL,  -- OWNER no tiene agency_id
  NULL,  -- OWNER no tiene tenant_id
  'email',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  role = 'OWNER'::public.user_role,
  agency_id = NULL,
  tenant_id = NULL,
  updated_at = NOW();

-- ============================================================
-- PASO 2B: Actualizar app_metadata en auth.users (para JWT claims)
-- ============================================================
-- Esto debe hacerse usando la API de Supabase Admin o desde código
-- El app_metadata debe incluir:
-- {
--   "user_role": "OWNER",
--   "agency_id": null,
--   "tenant_id": null
-- }

-- ============================================================
-- MÉTODO ALTERNATIVO: Usar Supabase Dashboard (MÁS FÁCIL)
-- ============================================================
/*
1. Ve a Supabase Dashboard > Authentication > Users
2. Click en "Add User" > "Create new user"
3. Ingresa:
   - Email: owner@tusistema.com
   - Password: (una contraseña segura)
   - Auto Confirm User: ✅ (marca esta opción)
4. Guarda el user ID que se muestra
5. Ejecuta el PASO 2A arriba con ese user ID
6. Desde código o API, actualiza app_metadata del usuario
*/

-- ============================================================
-- VERIFICACIÓN: Confirmar que el OWNER fue creado correctamente
-- ============================================================
SELECT 
  id,
  email,
  name,
  role,
  agency_id,
  tenant_id,
  provider,
  created_at
FROM public.users
WHERE role = 'OWNER'::public.user_role
ORDER BY created_at DESC;

-- Debe mostrar el usuario OWNER con:
-- - role = 'OWNER'
-- - agency_id = NULL
-- - tenant_id = NULL

