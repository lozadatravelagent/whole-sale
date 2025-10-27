-- Script para crear un tenant y asignar todas las agencias a ese tenant
-- Ejecuta esto en Supabase Dashboard > SQL Editor

-- Paso 1: Verificar tenants existentes
SELECT id, name, status FROM tenants;

-- Paso 2: Crear un nuevo tenant (ajusta el nombre según necesites)
INSERT INTO tenants (name, status)
VALUES ('WholeSale Travel Group', 'active')
ON CONFLICT DO NOTHING
RETURNING id, name, status;

-- Paso 3: Ver el ID del tenant creado (cópialo para usarlo abajo)
-- Reemplaza 'TU_TENANT_ID_AQUI' con el ID real del tenant

-- Paso 4: Asignar todas las agencias existentes a este tenant
-- IMPORTANTE: Reemplaza 'TU_TENANT_ID_AQUI' con el ID del tenant que acabas de crear
UPDATE agencies
SET tenant_id = 'TU_TENANT_ID_AQUI'::uuid
WHERE tenant_id IS NULL;

-- Paso 5: Verificar que las agencias fueron asignadas correctamente
SELECT
  a.id,
  a.name as agency_name,
  a.tenant_id,
  t.name as tenant_name
FROM agencies a
LEFT JOIN tenants t ON a.tenant_id = t.id
ORDER BY a.name;

-- Paso 6: Actualizar usuarios para asignarlos al tenant
-- IMPORTANTE: Reemplaza 'TU_TENANT_ID_AQUI' con el ID del tenant
UPDATE users u
SET tenant_id = 'TU_TENANT_ID_AQUI'::uuid
WHERE tenant_id IS NULL
  AND agency_id IN (
    SELECT id FROM agencies WHERE tenant_id = 'TU_TENANT_ID_AQUI'::uuid
  );

-- Paso 7: Verificar usuarios asignados
SELECT
  u.id,
  u.email,
  u.role,
  u.tenant_id,
  t.name as tenant_name,
  u.agency_id,
  a.name as agency_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN agencies a ON u.agency_id = a.id
ORDER BY u.email;

-- Paso 8: Actualizar JWT claims de los usuarios para que tengan el tenant_id
-- IMPORTANTE: Reemplaza 'TU_TENANT_ID_AQUI' con el ID del tenant
UPDATE auth.users au
SET raw_app_meta_data = jsonb_build_object(
  'user_role', u.role::text,
  'agency_id', u.agency_id::text,
  'tenant_id', 'TU_TENANT_ID_AQUI'
)
FROM public.users u
WHERE au.id = u.id
  AND u.tenant_id = 'TU_TENANT_ID_AQUI'::uuid;

SELECT 'Tenant creado y agencias asignadas correctamente!' as status;
