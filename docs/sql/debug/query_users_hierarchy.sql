-- Consulta completa de usuarios con toda su información jerárquica
-- Este script muestra la jerarquía de roles y relaciones en WholeSale Connect AI

-- 1. RESUMEN DE ROLES EN EL SISTEMA
SELECT
  role,
  COUNT(*) as cantidad_usuarios,
  string_agg(DISTINCT COALESCE(name, email), ', ') as usuarios
FROM users
GROUP BY role
ORDER BY
  CASE role
    WHEN 'OWNER' THEN 1
    WHEN 'SUPERADMIN' THEN 2
    WHEN 'ADMIN' THEN 3
    WHEN 'SELLER' THEN 4
  END;

-- 2. USUARIOS COMPLETOS CON JERARQUÍA
SELECT
  u.id,
  u.name,
  u.email,
  u.role,
  u.provider,
  t.name as tenant_name,
  t.id as tenant_id,
  a.name as agency_name,
  a.id as agency_id,
  a.status as agency_status,
  u.created_at
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
  u.created_at;

-- 3. ESTRUCTURA DE TENANTS Y AGENCIAS
SELECT
  t.name as tenant,
  COUNT(DISTINCT a.id) as num_agencias,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'SUPERADMIN') as superadmins,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'ADMIN') as admins,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'SELLER') as sellers,
  string_agg(DISTINCT a.name, ', ') as agencias
FROM tenants t
LEFT JOIN agencies a ON a.tenant_id = t.id
LEFT JOIN users u ON u.tenant_id = t.id
GROUP BY t.id, t.name;

-- 4. VISTA DETALLADA POR AGENCIA
SELECT
  a.name as agencia,
  t.name as tenant,
  COUNT(*) FILTER (WHERE u.role = 'SUPERADMIN') as superadmins,
  COUNT(*) FILTER (WHERE u.role = 'ADMIN') as admins,
  COUNT(*) FILTER (WHERE u.role = 'SELLER') as sellers,
  string_agg(
    COALESCE(u.name, u.email) || ' (' || u.role || ')',
    ', '
    ORDER BY
      CASE u.role
        WHEN 'SUPERADMIN' THEN 1
        WHEN 'ADMIN' THEN 2
        WHEN 'SELLER' THEN 3
      END
  ) as usuarios
FROM agencies a
LEFT JOIN tenants t ON a.tenant_id = t.id
LEFT JOIN users u ON u.agency_id = a.id
GROUP BY a.id, a.name, t.name
ORDER BY t.name, a.name;

-- 5. OWNERS (usuarios sin tenant/agency)
SELECT
  id,
  name,
  email,
  role,
  created_at
FROM users
WHERE role = 'OWNER';
