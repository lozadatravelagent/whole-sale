# 🐛 Problema: SUPERADMIN ve usuarios de agencias no asignadas

## 📋 Descripción del Problema

**Usuario afectado:** `superadmin@superadmin.com`

**Síntomas:**
- El SUPERADMIN está asignado SOLO a "lozada agency" (visible en `/agencies`)
- PERO en `/users` ve usuarios de "Agency Team" que NO es su agencia asignada
- Ve: `agency@agency.com` (ADMIN), `seller@seller.com` (SELLER), `seller2@seller2.com` (SELLER)

**Comportamiento esperado:**
- SUPERADMIN solo debería ver usuarios de "lozada agency"
- NO debería ver usuarios de "Agency Team"

---

## 🔍 Causa Raíz del Problema

### ⚠️ PROBLEMA REAL IDENTIFICADO:

**La tabla `superadmin_agency_assignments` NO EXISTE en la base de datos remota de Supabase.**

Cuando ejecutamos:
```sql
SELECT * FROM superadmin_agency_assignments;
```

Obtenemos:
```
ERROR: 42P01: relation "superadmin_agency_assignments" does not exist
```

### Historia de Migraciones

1. **Migración original** (`20251005000002_user_management_helpers.sql`):
   - Política RLS usaba `users.agency_id` directamente
   - SUPERADMIN veía usuarios donde `users.agency_id = users.agency_id` del SUPERADMIN
   ```sql
   OR (
     public.get_user_role() = 'SUPERADMIN'
     AND agency_id = public.get_user_agency_id()  -- Usa users.agency_id
   )
   ```

2. **Migración PROBLEMÁTICA** (`20251005100000_superadmin_multiple_agencies.sql`):
   - ❌ **NO se aplicó en Supabase remota** (tabla no existe)
   - ✅ SÍ existe en archivos locales
   - Debería crear tabla `superadmin_agency_assignments`
   - Cambió política RLS para usar `get_superadmin_agency_ids()`

### El Problema

**Inconsistencia entre código local y base de datos remota:**

1. **Localmente** (archivos en `supabase/migrations/`):
   - ✅ Existe migración `20251005100000_superadmin_multiple_agencies.sql`
   - ✅ Política RLS usa `get_superadmin_agency_ids()`

2. **Remotamente** (Supabase):
   - ❌ Tabla `superadmin_agency_assignments` NO existe
   - ❌ Función `get_superadmin_agency_ids()` probablemente NO existe o falla
   - ⚠️ Política RLS puede estar corrupta o usando fallback incorrecto

**Resultado:**
- La política RLS intenta usar una tabla que no existe
- PostgreSQL puede estar usando un fallback o policy antigua
- El filtrado RLS falla silenciosamente
- SUPERADMIN ve usuarios que NO debería ver

---

## 🔧 Soluciones

### ⚡ Opción A: FIX URGENTE - Revertir a Política Simple (RECOMENDADO) ✅

**Esta es la solución INMEDIATA porque:**
- ❌ La tabla `superadmin_agency_assignments` NO existe
- ✅ No requiere crear tablas ni migrar datos
- ✅ Funciona inmediatamente
- ✅ Usa `users.agency_id` que SÍ existe y está poblado

**Ejecutar este script en SQL Editor de Supabase:**

📄 **Archivo: [`FIX_SUPERADMIN_RLS_URGENTE.sql`](FIX_SUPERADMIN_RLS_URGENTE.sql)**

```sql
-- Revertir política RLS a usar users.agency_id (simple)
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_owner()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = public.get_user_agency_id()  -- Usa users.agency_id
  )
  OR (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);

-- También actualizar INSERT policy por consistencia
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
```

**Verificación después del fix:**
```sql
-- Debería mostrar solo usuarios de "lozada agency"
SELECT u.email, u.role, a.name as agency
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE u.agency_id = (SELECT agency_id FROM users WHERE email = 'superadmin@superadmin.com')
   OR u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com');
```

---

### Opción B: Aplicar Migración de Asignaciones Múltiples (FUTURO)

**Solo si quieres funcionalidad de múltiples agencias para SUPERADMIN.**

**Pre-requisitos:**
- Primero aplicar Opción A (fix urgente)
- Luego decidir si necesitas asignaciones múltiples

**Pasos:**

1. **Aplicar migración completa:**
   ```sql
   -- Migrar agency_id de users.agency_id a superadmin_agency_assignments
   INSERT INTO superadmin_agency_assignments (superadmin_id, agency_id, assigned_by)
   SELECT
     u.id,
     u.agency_id,
     (SELECT id FROM users WHERE role = 'OWNER' LIMIT 1)
   FROM users u
   WHERE u.role = 'SUPERADMIN'
     AND u.agency_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM superadmin_agency_assignments saa
       WHERE saa.superadmin_id = u.id
     )
   ON CONFLICT (superadmin_id, agency_id) DO NOTHING;
   ```

2. **Verificar asignaciones:**
   ```sql
   SELECT
     u.email,
     a.name as agency_name,
     saa.assigned_at
   FROM superadmin_agency_assignments saa
   JOIN users u ON saa.superadmin_id = u.id
   JOIN agencies a ON saa.agency_id = a.id
   WHERE u.email = 'superadmin@superadmin.com';
   ```

   **Resultado esperado:**
   ```
   email                     | agency_name   | assigned_at
   --------------------------|---------------|-------------------------
   superadmin@superadmin.com | lozada agency | 2025-10-05 12:00:00
   ```

3. **Verificar visibilidad de usuarios:**
   ```sql
   -- Como superadmin@superadmin.com, debería ver solo:
   SELECT u.email, u.role, a.name as agency
   FROM users u
   LEFT JOIN agencies a ON u.agency_id = a.id
   WHERE u.agency_id = ANY(
     SELECT agency_id FROM superadmin_agency_assignments
     WHERE superadmin_id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com')
   )
   OR u.id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com');
   ```

**Ejecutar script completo:**
- Usa el archivo: [`fix_superadmin_agency_assignments.sql`](fix_superadmin_agency_assignments.sql)
- Ejecuta la **Opción A** del script

---

### Opción B: Revertir a Política RLS Simple ⚠️

**Ventajas:**
- Más simple, usa solo `users.agency_id`
- No requiere tabla adicional
- Compatibilidad con modelo antiguo

**Desventajas:**
- Pierde funcionalidad de asignaciones múltiples
- SUPERADMIN solo puede gestionar 1 agencia
- Menos flexible

**Pasos:**

1. **Revertir política RLS:**
   ```sql
   DROP POLICY IF EXISTS "users_select_policy" ON public.users;

   CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
   USING (
     id = auth.uid()
     OR public.is_owner()
     OR (
       public.get_user_role() = 'SUPERADMIN'
       AND agency_id = public.get_user_agency_id()  -- Vuelve a usar users.agency_id
     )
     OR (
       public.get_user_role() = 'ADMIN'
       AND agency_id = public.get_user_agency_id()
       AND role = 'SELLER'::public.user_role
     )
   );
   ```

2. **Opcional: Eliminar tabla de asignaciones**
   ```sql
   DROP TABLE IF EXISTS public.superadmin_agency_assignments CASCADE;
   DROP FUNCTION IF EXISTS public.get_superadmin_agency_ids() CASCADE;
   ```

**Ejecutar script completo:**
- Usa el archivo: [`fix_superadmin_agency_assignments.sql`](fix_superadmin_agency_assignments.sql)
- Ejecuta la **Opción B** del script (está comentada)

---

## 🧪 Pruebas y Verificación

### Test 1: Verificar Estado Actual

```sql
-- 1. Ver configuración del SUPERADMIN
SELECT
  email,
  agency_id as agency_in_users_table,
  (SELECT name FROM agencies WHERE id = users.agency_id) as agency_name
FROM users
WHERE email = 'superadmin@superadmin.com';

-- 2. Ver asignaciones en tabla de asignaciones
SELECT COUNT(*) as asignaciones_count
FROM superadmin_agency_assignments
WHERE superadmin_id = (SELECT id FROM users WHERE email = 'superadmin@superadmin.com');

-- 3. Probar función get_superadmin_agency_ids()
-- (Ejecutar como superadmin@superadmin.com)
SELECT public.get_superadmin_agency_ids() as agencias_asignadas;
```

**Resultados esperados ANTES de la corrección:**
```
-- Query 1:
email                     | agency_in_users_table        | agency_name
--------------------------|------------------------------|-------------
superadmin@superadmin.com | abc-123-lozada-agency-uuid   | lozada agency

-- Query 2:
asignaciones_count
------------------
0

-- Query 3:
agencias_asignadas
------------------
{}  -- Array vacío!
```

### Test 2: Verificar Después de Corrección (Opción A)

```sql
-- 1. Verificar asignación creada
SELECT
  u.email,
  a.name as agency_name,
  saa.assigned_at
FROM superadmin_agency_assignments saa
JOIN users u ON saa.superadmin_id = u.id
JOIN agencies a ON saa.agency_id = a.id
WHERE u.email = 'superadmin@superadmin.com';

-- 2. Verificar función get_superadmin_agency_ids()
SELECT public.get_superadmin_agency_ids() as agencias_asignadas;

-- 3. Verificar usuarios visibles (debería ver solo lozada agency)
SELECT
  u.email,
  u.role,
  a.name as agency_name
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
WHERE
  u.id = auth.uid()
  OR public.is_owner()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND u.agency_id = ANY(public.get_superadmin_agency_ids())
  );
```

**Resultados esperados DESPUÉS de la corrección:**
```
-- Query 1:
email                     | agency_name   | assigned_at
--------------------------|---------------|-------------------------
superadmin@superadmin.com | lozada agency | 2025-10-05 12:00:00

-- Query 2:
agencias_asignadas
-------------------------------------------
{abc-123-lozada-agency-uuid}  -- Array con 1 UUID

-- Query 3: (Solo usuarios de lozada agency)
email                     | role      | agency_name
--------------------------|-----------|-------------
superadmin@superadmin.com | SUPERADMIN| lozada agency
user1@lozada.com          | SELLER    | lozada agency
user2@lozada.com          | ADMIN     | lozada agency
-- NO debería aparecer: agency@agency.com (de Agency Team)
```

---

## 📊 Comparación de Políticas RLS

### Política Antigua (users.agency_id)
```sql
CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_owner()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = public.get_user_agency_id()  -- ✅ Simple, usa users.agency_id
  )
  OR (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);
```

**Pros:**
- ✅ Simple y directo
- ✅ No requiere tablas adicionales
- ✅ Funciona siempre que users.agency_id esté poblado

**Cons:**
- ❌ SUPERADMIN solo puede gestionar 1 agencia
- ❌ No escalable para múltiples agencias

---

### Política Nueva (superadmin_agency_assignments)
```sql
CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_owner()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = ANY(public.get_superadmin_agency_ids())  -- ✅ Flexible, múltiples agencias
  )
  OR (
    public.get_user_role() = 'ADMIN'
    AND agency_id = public.get_user_agency_id()
    AND role = 'SELLER'::public.user_role
  )
);
```

**Pros:**
- ✅ SUPERADMIN puede gestionar múltiples agencias
- ✅ Escalable y flexible
- ✅ Modelo moderno y extensible

**Cons:**
- ❌ Requiere migración de datos (users.agency_id → superadmin_agency_assignments)
- ❌ Más complejo, tabla adicional
- ❌ **BUG actual:** No funciona si no hay asignaciones

---

## 🚨 Diagnóstico Rápido en Supabase

### Paso 1: Verificar qué política está activa

```sql
-- Ver políticas actuales en la tabla users
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users'
  AND policyname = 'users_select_policy';
```

### Paso 2: Ver contenido de la política

```sql
-- Si la política usa get_superadmin_agency_ids(), entonces es la NUEVA
-- Si usa get_user_agency_id() directamente, es la ANTIGUA

SELECT pg_get_expr(polqual, polrelid) as policy_definition
FROM pg_policy
WHERE polname = 'users_select_policy'
  AND polrelid = 'public.users'::regclass;
```

**Resultado esperado (Política NUEVA):**
```sql
(
  id = auth.uid()
  OR public.is_owner()
  OR (
    public.get_user_role() = 'SUPERADMIN'
    AND agency_id = ANY(public.get_superadmin_agency_ids())  -- ← NUEVA
  )
  ...
)
```

**Si ves esto, ejecuta Opción A del fix**

---

## 📝 Checklist de Corrección

### ✅ Opción A (Asignaciones Múltiples)

- [ ] 1. Conectar a Supabase SQL Editor
- [ ] 2. Ejecutar diagnóstico inicial (sección 1-3 de `fix_superadmin_agency_assignments.sql`)
- [ ] 3. Confirmar que `get_superadmin_agency_ids()` retorna `[]` para `superadmin@superadmin.com`
- [ ] 4. Ejecutar migración de datos (sección 5 - Opción A)
- [ ] 5. Verificar que se creó registro en `superadmin_agency_assignments`
- [ ] 6. Probar función `get_superadmin_agency_ids()` - debería retornar `[lozada-agency-uuid]`
- [ ] 7. Verificar en `/users` - solo debería ver usuarios de "lozada agency"
- [ ] 8. Confirmar que NO ve usuarios de "Agency Team"

### ⚠️ Opción B (Revertir a Simple)

- [ ] 1. Conectar a Supabase SQL Editor
- [ ] 2. Descomentar y ejecutar Opción B del script
- [ ] 3. Verificar que política RLS cambió a usar `get_user_agency_id()`
- [ ] 4. Verificar en `/users` - solo debería ver usuarios de "lozada agency"
- [ ] 5. Confirmar que NO ve usuarios de "Agency Team"
- [ ] 6. Opcional: Eliminar tabla `superadmin_agency_assignments`

---

## 🎯 Recomendación Final

**Usar Opción A (Asignaciones Múltiples)** porque:

1. ✅ Es el modelo futuro (ya existe la migración)
2. ✅ Permite escalabilidad (múltiples agencias por SUPERADMIN)
3. ✅ Solo requiere migrar datos existentes (1 INSERT por SUPERADMIN)
4. ✅ No requiere revertir código ni migraciones

**Ejecutar:**
```bash
# 1. Abrir Supabase Dashboard → SQL Editor
# 2. Copiar y ejecutar: fix_superadmin_agency_assignments.sql (Opción A)
# 3. Verificar con las queries de la sección "Test 2"
# 4. Refrescar /users en el frontend
```

---

## 📚 Archivos Relacionados

- [`fix_superadmin_agency_assignments.sql`](fix_superadmin_agency_assignments.sql) - Script de corrección
- [`20251005100000_superadmin_multiple_agencies.sql`](supabase/migrations/20251005100000_superadmin_multiple_agencies.sql) - Migración que causó el problema
- [`20251005000002_user_management_helpers.sql`](supabase/migrations/20251005000002_user_management_helpers.sql) - Migración anterior (funcionaba)
- [`JERARQUIA_ROLES_Y_DASHBOARD.md`](JERARQUIA_ROLES_Y_DASHBOARD.md) - Documentación de roles
- [`useUsers.ts`](src/hooks/useUsers.ts) - Hook de gestión de usuarios

---

**Fecha del problema:** 5 de Octubre 2025
**Usuario afectado:** `superadmin@superadmin.com`
**Estado:** 🔴 Pendiente de corrección
**Solución recomendada:** Opción A - Migrar a asignaciones múltiples
