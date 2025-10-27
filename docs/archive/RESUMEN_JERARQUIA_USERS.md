# 👥 Resumen: Jerarquía en `/users`

## 🎯 ¿Qué hace el FIX?

El fix **corrige la política RLS** (Row Level Security) para que cada rol vea SOLO los usuarios que debe ver según la jerarquía.

**Cambio específico:**
```sql
-- ANTES (ROTO):
AND agency_id = ANY(public.get_superadmin_agency_ids())  -- ❌ Busca en tabla inexistente

-- DESPUÉS (CORRECTO):
AND agency_id = public.get_user_agency_id()  -- ✅ Usa users.agency_id directo
```

---

## 🏗️ Jerarquía de Roles (de mayor a menor poder)

```
👑 OWNER (Sistema Global)
  ↓ ve TODO
🔧 SUPERADMIN (Mayorista/Tenant)
  ↓ ve su tenant
👔 ADMIN (Agencia)
  ↓ ve su agencia
👤 SELLER (Vendedor)
  ↓ ve solo sí mismo
```

---

## 📊 ¿Qué ve cada rol en `/users`?

### 1. 👑 OWNER

**Ve:** TODOS los usuarios del sistema (cross-tenant)

**Ejemplo:**
```
Users List
15 users total

Email                     | Role       | Agency            | Tenant
--------------------------|------------|-------------------|------------------
owner@system.com          | OWNER      | -                 | -
superadmin@tenant1.com    | SUPERADMIN | -                 | Mayorista España
admin@agency1.com         | ADMIN      | Travel Dreams     | Mayorista España
seller1@agency1.com       | SELLER     | Travel Dreams     | Mayorista España
superadmin@tenant2.com    | SUPERADMIN | -                 | Mayorista México
admin@agency2.com         | ADMIN      | Viajes Cancún     | Mayorista México
seller1@agency2.com       | SELLER     | Viajes Cancún     | Mayorista México
... (todos los usuarios)
```

**Funcionalidades:**
- ✅ Ve usuarios de TODOS los tenants
- ✅ Ve usuarios de TODAS las agencias
- ✅ Puede crear: OWNER, SUPERADMIN, ADMIN, SELLER
- ✅ Puede editar: Todos
- ✅ Puede eliminar: Todos (hard delete)

---

### 2. 🔧 SUPERADMIN (Ejemplo: `superadmin@superadmin.com`)

**Asignación:** "lozada agency"

**Ve:** Solo usuarios de SU agencia asignada

**Ejemplo DESPUÉS del FIX:**
```
Users List
4 users visible (OWNER users hidden)

Email                     | Role       | Agency
--------------------------|------------|------------------
superadmin@superadmin.com | SUPERADMIN | lozada agency
admin@lozada.com          | ADMIN      | lozada agency
seller1@lozada.com        | SELLER     | lozada agency
seller2@lozada.com        | SELLER     | lozada agency
```

**NO ve:**
```
❌ agency@agency.com      | ADMIN      | Agency Team
❌ seller@seller.com      | SELLER     | Agency Team
❌ seller2@seller2.com    | SELLER     | Agency Team
```

**Funcionalidades:**
- ✅ Ve solo usuarios de "lozada agency"
- ✅ Puede crear: SUPERADMIN, ADMIN, SELLER (solo en su agency)
- ❌ NO puede crear: OWNER
- ✅ Puede editar: Usuarios de su agency (excepto OWNER)
- ❌ NO puede eliminar (hard delete)

**Regla RLS:**
```sql
-- SUPERADMIN ve usuarios donde:
users.agency_id = (SELECT agency_id FROM users WHERE id = auth.uid())

-- Es decir:
-- Si superadmin@superadmin.com tiene agency_id = 'lozada-uuid'
-- Solo ve usuarios con agency_id = 'lozada-uuid'
```

---

### 3. 👔 ADMIN (Ejemplo: `admin@agency.com`)

**Asignación:** "Agency Team"

**Ve:** Solo SELLERS de SU agencia

**Ejemplo:**
```
Users List
3 users visible (OWNER users hidden)

Email                | Role   | Agency
---------------------|--------|------------------
admin@agency.com     | ADMIN  | Agency Team  (self)
seller@seller.com    | SELLER | Agency Team
seller2@seller2.com  | SELLER | Agency Team
```

**NO ve:**
```
❌ superadmin@superadmin.com | SUPERADMIN | lozada agency
❌ admin@lozada.com          | ADMIN      | lozada agency
❌ seller1@lozada.com        | SELLER     | lozada agency
❌ otro-admin@agency.com     | ADMIN      | Agency Team  (otros ADMINS)
```

**Funcionalidades:**
- ✅ Ve solo SELLERS de "Agency Team"
- ✅ Ve sí mismo (self)
- ✅ Puede crear: SELLER (solo en su agencia)
- ❌ NO puede crear: OWNER, SUPERADMIN, ADMIN
- ✅ Puede editar: SELLERS de su agencia
- ❌ NO puede editar: Otros ADMINS, SUPERADMINS, OWNERS
- ❌ NO puede eliminar

**Regla RLS:**
```sql
-- ADMIN ve usuarios donde:
users.agency_id = (SELECT agency_id FROM users WHERE id = auth.uid())
AND users.role = 'SELLER'

-- Es decir:
-- Si admin@agency.com tiene agency_id = 'agency-team-uuid'
-- Solo ve SELLERS con agency_id = 'agency-team-uuid'
```

---

### 4. 👤 SELLER (Ejemplo: `seller@seller.com`)

**Asignación:** "Agency Team"

**Ve:** SOLO sí mismo

**Ejemplo:**
```
Users List
1 user visible (OWNER users hidden)

Email               | Role   | Agency
--------------------|--------|------------------
seller@seller.com   | SELLER | Agency Team  (self)
```

**NO ve:**
```
❌ admin@agency.com     | ADMIN  | Agency Team
❌ seller2@seller.com   | SELLER | Agency Team  (otro seller)
❌ Cualquier otro usuario del sistema
```

**Funcionalidades:**
- ✅ Ve solo SU propio usuario
- ❌ NO puede crear usuarios
- ❌ NO puede editar usuarios (excepto su perfil)
- ❌ NO puede eliminar
- ❌ NO tiene acceso a `/users` (normalmente redirigido o sin permisos)

**Regla RLS:**
```sql
-- SELLER ve usuarios donde:
users.id = auth.uid()

-- Es decir:
-- Solo ve su propio registro
```

---

## 🔐 Política RLS Completa (DESPUÉS del FIX)

```sql
CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  -- 1. Puede ver sí mismo (cualquier rol)
  id = auth.uid()

  OR

  -- 2. OWNER ve todos
  public.is_owner()

  OR

  -- 3. SUPERADMIN ve usuarios de su agencia
  (
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = public.get_user_agency_id()
  )

  OR

  -- 4. ADMIN ve SELLERS de su agencia
  (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);
```

**Funciones helper:**
- `public.is_owner()` → Retorna `true` si el usuario actual es OWNER
- `public.get_user_role()` → Retorna el rol del usuario actual
- `public.get_user_agency_id()` → Retorna el `agency_id` del usuario actual

---

## 📋 Tabla Comparativa

| Rol | Ve usuarios de | Ejemplo práctico |
|-----|----------------|------------------|
| **OWNER** | Todos (cross-tenant) | Ve 100% del sistema |
| **SUPERADMIN** | Su agencia asignada | `superadmin@superadmin.com` ve solo "lozada agency" |
| **ADMIN** | Solo SELLERS de su agencia | `admin@agency.com` ve solo SELLERS de "Agency Team" |
| **SELLER** | Solo sí mismo | `seller@seller.com` ve solo su propio usuario |

---

## 🧪 Ejemplos Prácticos

### Escenario 1: Sistema con 2 agencias

**Base de datos:**
```
users table:
┌─────────────────────────┬────────────┬──────────────┐
│ email                   │ role       │ agency_id    │
├─────────────────────────┼────────────┼──────────────┤
│ owner@system.com        │ OWNER      │ NULL         │
│ superadmin@superadmin...│ SUPERADMIN │ lozada-uuid  │
│ admin@lozada.com        │ ADMIN      │ lozada-uuid  │
│ seller1@lozada.com      │ SELLER     │ lozada-uuid  │
│ seller2@lozada.com      │ SELLER     │ lozada-uuid  │
│ admin@agency.com        │ ADMIN      │ agency-uuid  │
│ seller@seller.com       │ SELLER     │ agency-uuid  │
│ seller2@seller2.com     │ SELLER     │ agency-uuid  │
└─────────────────────────┴────────────┴──────────────┘
```

**¿Qué ve cada uno en `/users`?**

#### `owner@system.com` (OWNER):
```
✅ owner@system.com        | OWNER      | -
✅ superadmin@superadmin...| SUPERADMIN | lozada agency
✅ admin@lozada.com        | ADMIN      | lozada agency
✅ seller1@lozada.com      | SELLER     | lozada agency
✅ seller2@lozada.com      | SELLER     | lozada agency
✅ admin@agency.com        | ADMIN      | Agency Team
✅ seller@seller.com       | SELLER     | Agency Team
✅ seller2@seller2.com     | SELLER     | Agency Team
```
**Total: 8 usuarios**

---

#### `superadmin@superadmin.com` (SUPERADMIN de lozada):
```
✅ superadmin@superadmin...| SUPERADMIN | lozada agency  (self)
✅ admin@lozada.com        | ADMIN      | lozada agency
✅ seller1@lozada.com      | SELLER     | lozada agency
✅ seller2@lozada.com      | SELLER     | lozada agency
❌ admin@agency.com        | ADMIN      | Agency Team     (otra agencia)
❌ seller@seller.com       | SELLER     | Agency Team     (otra agencia)
❌ seller2@seller2.com     | SELLER     | Agency Team     (otra agencia)
```
**Total: 4 usuarios (solo lozada agency)**

---

#### `admin@agency.com` (ADMIN de Agency Team):
```
✅ admin@agency.com        | ADMIN      | Agency Team    (self)
✅ seller@seller.com       | SELLER     | Agency Team
✅ seller2@seller2.com     | SELLER     | Agency Team
❌ superadmin@superadmin...| SUPERADMIN | lozada agency  (otra agencia)
❌ admin@lozada.com        | ADMIN      | lozada agency  (otra agencia)
❌ seller1@lozada.com      | SELLER     | lozada agency  (otra agencia)
```
**Total: 3 usuarios (self + SELLERS de Agency Team)**

---

#### `seller@seller.com` (SELLER de Agency Team):
```
✅ seller@seller.com       | SELLER     | Agency Team    (self)
❌ admin@agency.com        | ADMIN      | Agency Team    (su jefe, NO lo ve)
❌ seller2@seller2.com     | SELLER     | Agency Team    (compañero, NO lo ve)
❌ Todos los demás...
```
**Total: 1 usuario (solo sí mismo)**

---

## 🎯 Problema ANTES del Fix

### `superadmin@superadmin.com` ANTES:
```
❌ INCORRECTO - Veía:
✅ superadmin@superadmin...| SUPERADMIN | lozada agency  (correcto)
❌ admin@agency.com        | ADMIN      | Agency Team     (INCORRECTO!)
❌ seller@seller.com       | SELLER     | Agency Team     (INCORRECTO!)
❌ seller2@seller2.com     | SELLER     | Agency Team     (INCORRECTO!)
```

**Razón:**
- Política RLS buscaba en `superadmin_agency_assignments` (tabla inexistente)
- Fallaba y mostraba usuarios incorrectos
- **Violación de seguridad** ⚠️

### `superadmin@superadmin.com` DESPUÉS del Fix:
```
✅ CORRECTO - Ve:
✅ superadmin@superadmin...| SUPERADMIN | lozada agency
✅ admin@lozada.com        | ADMIN      | lozada agency
✅ seller1@lozada.com      | SELLER     | lozada agency
✅ seller2@lozada.com      | SELLER     | lozada agency
```

**Razón:**
- Política RLS usa `users.agency_id` directamente
- Funciona correctamente
- **Seguridad restaurada** ✅

---

## 🔧 Verificación Post-Fix

### SQL para verificar:

```sql
-- 1. Verificar política RLS activa
SELECT
  policyname,
  pg_get_expr(polqual, polrelid) as definition
FROM pg_policy
WHERE polname = 'users_select_policy'
  AND polrelid = 'public.users'::regclass;

-- Debe contener: "agency_id = public.get_user_agency_id()"
-- NO debe contener: "ANY(public.get_superadmin_agency_ids())"

-- 2. Simular vista de superadmin@superadmin.com
SELECT
  u.email,
  u.role,
  a.name as agency
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE
  -- Self
  u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com')
  OR
  -- Same agency
  u.agency_id = (SELECT agency_id FROM users WHERE email = 'superadmin@superadmin.com');

-- Resultado esperado:
-- superadmin@superadmin.com | SUPERADMIN | lozada agency
-- [otros usuarios]          | ...        | lozada agency
-- (NO debe aparecer Agency Team)
```

### Frontend para verificar:

1. Login como `superadmin@superadmin.com`
2. Ir a `/users`
3. Contar usuarios visibles
4. Verificar que ALL tienen "lozada agency"
5. Verificar que NINGUNO tiene "Agency Team"

---

## 📝 Resumen en 3 Puntos

1. **Jerarquía:** OWNER > SUPERADMIN > ADMIN > SELLER
2. **Visibilidad:** Cada rol ve solo lo que le corresponde según su `agency_id`
3. **Fix:** Cambió RLS de tabla inexistente a `users.agency_id` directo

---

## 📚 Para Más Información

- **[RESUMEN_PROBLEMA_Y_SOLUCION.md](RESUMEN_PROBLEMA_Y_SOLUCION.md)** - Guía completa del fix
- **[FIX_SUPERADMIN_RLS_URGENTE.sql](FIX_SUPERADMIN_RLS_URGENTE.sql)** - Script SQL
- **[JERARQUIA_ROLES_Y_DASHBOARD.md](JERARQUIA_ROLES_Y_DASHBOARD.md)** - Roles completos
- **[DIAGRAMA_JERARQUIA.md](DIAGRAMA_JERARQUIA.md)** - Diagramas visuales

---

**Fecha:** 5 de Octubre 2025
**Sistema:** WholeSale Connect AI
**Estado:** Documentado ✅
